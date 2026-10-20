// THE PLAYER'S CABIN IN THE VALLEY: the walk-in cabin (models/town/cabin_inside.glb, inside and out: porch, steps, a
// door that swings, logs and floor boards up close) stood at the cabin's place in town (W.places.cabin), in the same
// world as everything else: no scene of its own, no fade. It takes the place of the town's cabin model there (that one
// is hidden). Everything in it stands in the cabin's own frame (metres; the floor about 0.82 m up, the door on the +z
// side, the room running x -2.4 .. 3.0 and z -2.85 .. 0.6, the porch out to z 3.1): the pieces bought for its fixed slots
// (slots.js), the belt-buckle keepsakes, the dogs at home (homedogs.js, added by cabin.js).
//
// THE LIGHT INSIDE: the valley's own (its sun through the windows and the door, casting shadows; its day and night),
// with the sky's light on the inside surfaces turned down (it can't reach in there much) and a faint warm light from every
// side (the light bounced round the room), so the room reads as indoors and its shadows aren't black. At night that
// bounced light goes down with the daylight, and the lanterns and the stove light the room. They are not real lights: a
// PointLight in the valley would make every lit thing there costlier. Their light is worked out by the inside surfaces
// alone (the `lit` patch: up to three lamps, from the pieces' lamp markers, pieces.js lampOf), so it lights the room
// and nothing outside. Where the valley has no shadows (the potato tier) the sun's direct light on the inside surfaces is
// turned well down, or it would shine through the roof.
//
// FAR OFF the inside's things (the furniture, the keepsakes, the dogs on their beds, the lamps) are left out of the
// drawing (NEAR): through a window at that distance they can't be made out. The cabin itself is always drawn.
//
// Walls stop you as in tests/cabin.html: two balls (knee and chest high) are pushed sideways out of every nearby wall-
// like triangle, and the floor under you is found by rays straight down; the furniture is a box on the floor each.
//
//   const R = await makeHome({ W, renderer, base })   base: the game's folder URL (for models/)
//   R.group                              the cabin in the valley (W.scene's); R.inner: the inside's things (hidden far off)
//   R.toWorld(x, y, z, out) / R.toLocal(x, y, z, out)   the cabin's own frame <-> the valley's (Vector3 out)
//   R.yaw                                the cabin's turn in the valley (radians; a heading in its frame + yaw = the valley's)
//   R.floorUnder(x, z, fromY)            the floor's height under a spot (the cabin's frame: the highest surface no higher
//                                        than fromY; 0 where there's no cabin under it)
//   R.pushOut(body, { radius, balls })   pushes body { x, y, z } (its frame) out of the walls and furniture; -> true if moved
//   R.setDoor(t)                         the door, 0 shut .. 1 open (it swings into the room)
//   R.furnish(owned, { dogs })           shows the pieces owned (slot ids) and hides the rest; dogs: how many dog beds
//   R.ghost(id | null)                   a see-through look at a slot's piece, in its place, before it is bought
//   R.pop(id)                            a piece just bought grows into place
//   R.keepsakes([{ job, tier }])         the keepsakes earned
//   R.bedSpots(n)                        where the dog beds are: [{ x, y, z, rot }] (its frame)
//   R.lit(material)                      gives a material the inside light
//   R.near(on)                           the inside's things drawn (true) or left out (far off)
//   R.update(dt, { night })              the flames flicker, pieces settle, the lamps' light follows them; night: 0..1
//   R.porch                              { y, front } the porch floor's height and its front edge (z), the steps' foot (z)
//   R.dispose()                          frees everything and shows the town's own cabin model again
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SLOTS, SLOT, KEEPSAKE_SPOTS } from './slots.js';
import { makePiece, makeKeepsake, disposeTree, disposeShared } from './pieces.js';

export const LIGHT = {
  skyInside: 0.55,                        // the sky's light on the inside surfaces (a share of it)
  fill: [0.5, 0.38, 0.27],                // the bounced warm light with lanterns lit (they light the room themselves)
  fillBare: [0.95, 0.74, 0.52],           // ... and before there are any (the window light, bounced)
  fillNight: 0.2,                         // the bounced light's share left at full night (the lamps light it then)
  skyNight: 0.85,                         // and the moonlit sky's light inside, taken down this much more at full night (the
                                          // room is the lamps' then: warm, not the moon's blue)
  sunNoShadow: 0.12,                      // the sun's direct light on the inside surfaces where the valley has no shadows
  lamps: 3,                               // the most lamps the inside works out (two lanterns and the stove)
};
export const NEAR = { show: 26, hide: 30 };   // m from the cabin: the inside's things are drawn within `show`, left out past `hide`
const CELL = 0.5;
const loader = new GLTFLoader();
let modelP = null;
// the model, loaded once (started early: cabin.js calls it as the game boots, so it is there when the ride starts)
export function loadHomeModel(base = new URL('../../', import.meta.url).href) {
  return modelP || (modelP = loader.loadAsync(base + 'models/town/cabin_inside.glb').catch((e) => { modelP = null; throw e; }));
}

// FEWER DRAWS: a piece made in code (a keepsake, the rifle rack, a dog bed...) is many small shapes, each its own draw.
// Its plain-coloured shapes (no picture, not see-through) become one shape for the matte ones and one for the metal
// ones, their colours carried on the corners (vertex colours). Shapes from a model file are left as they are (they
// share the file's own), and so are the flames (they flicker) and anything with a picture.
const _inv = new THREE.Matrix4(), _rel = new THREE.Matrix4();
export function slim(root) {
  root.updateMatrixWorld(true); _inv.copy(root.matrixWorld).invert();
  const buckets = new Map();
  root.traverse((o) => {
    if (!o.isMesh || o.isSkinnedMesh || Array.isArray(o.material) || !o.material.isMeshStandardMaterial || o.material.map || o.material.transparent || o.material.alphaTest > 0 || o.userData.file) return;
    const m = o.material, k = (m.metalness > 0.3 ? 'metal' : 'matte') + (m.side === THREE.DoubleSide ? ':2' : '') + (m.emissive && m.emissive.getHex() ? ':' + m.emissive.getHex() : '');
    if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(o);
  });
  for (const list of buckets.values()) {
    if (list.length < 2) continue;
    const geos = [];
    let rough = 0;
    for (const o of list) {
      let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal') g.deleteAttribute(a);
      g.clearGroups();
      _rel.multiplyMatrices(_inv, o.matrixWorld); g.applyMatrix4(_rel);
      if (_rel.determinant() < 0) {   // (a mirrored shape: its triangles turned the right way round again)
        const P = g.attributes.position, N = g.attributes.normal;
        for (let i = 0; i < P.count; i += 3) for (const A of [P, N]) { const t = [A.getX(i + 1), A.getY(i + 1), A.getZ(i + 1)]; A.setXYZ(i + 1, A.getX(i + 2), A.getY(i + 2), A.getZ(i + 2)); A.setXYZ(i + 2, t[0], t[1], t[2]); }
      }
      const c = o.material.color, n = g.attributes.position.count, col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b; }
      g.setAttribute('color', new THREE.BufferAttribute(col, 3));
      geos.push(g); rough += o.material.roughness;
    }
    const merged = mergeGeometries(geos); for (const g of geos) g.dispose();
    if (!merged) continue;
    const m0 = list[0].material;
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: rough / list.length, metalness: m0.metalness > 0.3 ? 0.7 : 0, side: m0.side,
      emissive: m0.emissive ? m0.emissive.clone() : 0x000000, emissiveIntensity: m0.emissiveIntensity });
    const one = new THREE.Mesh(merged, mat); one.name = 'slim'; one.receiveShadow = true; one.castShadow = list.some((o) => o.castShadow);
    root.add(one);
    for (const o of list) { o.removeFromParent(); o.geometry.dispose(); o.material.dispose(); }
  }
  return root;
}

export async function makeHome({ W, renderer, base = new URL('../../', import.meta.url).href }) {
  const pl = W.places.cabin;
  if (!pl) throw new Error('no cabin place');
  const group = new THREE.Group(); group.name = 'player-cabin';
  const inner = new THREE.Group(); inner.name = 'cabin-inside'; group.add(inner);
  const own = new Set();                    // everything made here, freed in dispose (groups and their contents)
  const keep = (o) => { own.add(o); return o; };

  // ── THE INSIDE LIGHT (shared by every patched material) ──
  const U = {
    insideSky: { value: LIGHT.skyInside }, insideFill: { value: new THREE.Color(...LIGHT.fillBare) },
    insideSun: { value: 1 },
    lampAt: { value: Array.from({ length: LIGHT.lamps }, () => new THREE.Vector3()) },
    lampCol: { value: Array.from({ length: LIGHT.lamps }, () => new THREE.Vector3()) },
    lampFall: { value: Array.from({ length: LIGHT.lamps }, () => new THREE.Vector2(9, 1.4)) },
  };
  // (the valley's sun casts shadows only on the tiers that have them: else the inside would be sunlit through the roof)
  const sunCasts = () => { let on = false; W.scene.traverse((o) => { if (o.isDirectionalLight && o.castShadow) on = true; }); return on && renderer.shadowMap.enabled; };
  if (!sunCasts()) U.insideSun.value = LIGHT.sunNoShadow;
  const N = LIGHT.lamps;
  const patched = new WeakSet();
  function lit(m) {
    if (!m || patched.has(m) || !m.isMeshStandardMaterial) return m;
    patched.add(m);
    m.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, U);
      sh.fragmentShader = `uniform float insideSky;\nuniform vec3 insideFill;\nuniform float insideSun;\nuniform vec3 lampAt[${N}];\nuniform vec3 lampCol[${N}];\nuniform vec2 lampFall[${N}];\n` + sh.fragmentShader.replace('#include <lights_fragment_end>', `
        irradiance = irradiance * insideSky + insideFill;
        for (int i = 0; i < ${N}; i++) {
          vec3 lv = (viewMatrix * vec4(lampAt[i], 1.0)).xyz - geometryPosition;
          float ld = max(length(lv), 1e-3);
          float fall = 1.0 / max(pow(ld, lampFall[i].y), 0.01);
          float cut = clamp(1.0 - pow(ld / lampFall[i].x, 4.0), 0.0, 1.0);
          irradiance += lampCol[i] * fall * cut * cut * clamp(dot(geometryNormal, lv / ld), 0.0, 1.0);
        }
        #include <lights_fragment_end>
        reflectedLight.directDiffuse *= insideSun; reflectedLight.directSpecular *= insideSun;`);
    };
    m.customProgramCacheKey = () => 'bm-inside';
    m.needsUpdate = true;
    return m;
  }
  const litTree = (o) => o.traverse((c) => { if (c.isMesh) for (const m of [].concat(c.material)) lit(m); });

  // ── THE CABIN ──
  const gltf = await loadHomeModel(base);
  const cabin = keep(gltf.scene.clone(true)); group.add(cabin);
  const hinge = cabin.getObjectByName('DoorHinge');
  if (!hinge) throw new Error('cabin_inside.glb has no DoorHinge');
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  cabin.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = true;
    for (const m of [].concat(o.material)) {
      for (const t of [m.map, m.normalMap]) if (t) t.anisotropy = Math.min(8, maxAniso);
      if (m.name.startsWith('inside')) lit(m);
    }
  });
  group.updateMatrixWorld(true);              // (still at the valley's middle: the cabin's frame is the valley's here)

  // ── WHAT YOU BUMP INTO: every triangle of the cabin in half-metre cells (the door's own, moved as it swings) ──
  const cells = new Map(), doorTris = [], statMeshes = [];
  const key = (i, j) => i * 4096 + j;
  const nrm = new THREE.Vector3();
  const fit = (e) => { const t = e.t; e.y0 = Math.min(t.a.y, t.b.y, t.c.y); e.y1 = Math.max(t.a.y, t.b.y, t.c.y); e.ny = t.getNormal(nrm).y; };
  const entry = (tri) => { const e = { t: tri, y0: 0, y1: 0, ny: 0 }; fit(e); return e; };
  function addTris(m, list, toGrid) {
    const g = m.geometry, P = g.attributes.position, I = g.index, n = I ? I.count : P.count;
    for (let k = 0; k < n; k += 3) {
      const t = [0, 1, 2].map((q) => new THREE.Vector3().fromBufferAttribute(P, I ? I.getX(k + q) : k + q).applyMatrix4(m.matrixWorld));
      const tri = entry(new THREE.Triangle(t[0], t[1], t[2])); list.push(tri);
      if (!toGrid) continue;
      const x0 = Math.floor(Math.min(t[0].x, t[1].x, t[2].x) / CELL), x1 = Math.floor(Math.max(t[0].x, t[1].x, t[2].x) / CELL);
      const z0 = Math.floor(Math.min(t[0].z, t[1].z, t[2].z) / CELL), z1 = Math.floor(Math.max(t[0].z, t[1].z, t[2].z) / CELL);
      for (let i = x0; i <= x1; i++) for (let j = z0; j <= z1; j++) { const c = cells.get(key(i, j)); if (c) c.push(tri); else cells.set(key(i, j), [tri]); }
    }
  }
  const doorMeshes = [];
  cabin.traverse((o) => { if (!o.isMesh) return; let d = false; for (let p = o; p; p = p.parent) if (p === hinge) d = true; if (d) doorMeshes.push(o); else { statMeshes.push(o); addTris(o, [], true); } });
  const doorLocal = []; for (const m of doorMeshes) addTris(m, doorLocal, false);
  const hingeInv = new THREE.Matrix4().copy(hinge.matrixWorld).invert();
  const doorRest = doorLocal.map(({ t }) => new THREE.Triangle(t.a.clone().applyMatrix4(hingeInv), t.b.clone().applyMatrix4(hingeInv), t.c.clone().applyMatrix4(hingeInv)));
  for (let k = 0; k < doorRest.length; k++) doorTris.push(entry(new THREE.Triangle(new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3())));

  // ── STOOD IN THE VALLEY at the cabin's place: its middle over the spot, its feet on the ground, its front the place's ──
  group.position.set(pl.x, W.heightAt(pl.x, pl.z), pl.z);
  group.rotation.set(0, pl.rot, 0);
  group.updateMatrixWorld(true);
  const groupInv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const hingeRel = new THREE.Matrix4();
  function moveDoorTris() {
    hinge.updateMatrixWorld(true); hingeRel.multiplyMatrices(groupInv, hinge.matrixWorld);
    doorRest.forEach((t, k) => { const d = doorTris[k]; d.t.a.copy(t.a).applyMatrix4(hingeRel); d.t.b.copy(t.b).applyMatrix4(hingeRel); d.t.c.copy(t.c).applyMatrix4(hingeRel); fit(d); });
  }
  moveDoorTris();
  W.scene.add(group);
  const toWorld = (x, y, z, out = new THREE.Vector3()) => out.set(x, y, z).applyMatrix4(group.matrixWorld);
  const toLocal = (x, y, z, out = new THREE.Vector3()) => out.set(x, y, z).applyMatrix4(groupInv);

  function near(x, z, r) {
    const out = new Set();
    for (let i = Math.floor((x - r) / CELL); i <= Math.floor((x + r) / CELL); i++) for (let j = Math.floor((z - r) / CELL); j <= Math.floor((z + r) / CELL); j++) { const c = cells.get(key(i, j)); if (c) for (const t of c) out.add(t); }
    for (const t of doorTris) out.add(t);
    return out;
  }
  const ray = new THREE.Ray(), hitP = new THREE.Vector3(), cp = new THREE.Vector3(), ball = new THREE.Vector3();
  const FOOT = [[0, 0], [0.15, 0], [-0.15, 0], [0, 0.15], [0, -0.15]];
  function floorUnder(x, z, fromY, feet = FOOT) {
    let best = 0;
    const tris = near(x, z, 0.2);
    for (const [fx, fz] of feet) {
      ray.origin.set(x + fx, fromY, z + fz); ray.direction.set(0, -1, 0);
      for (const { t, y0, ny } of tris) {
        if (Math.abs(ny) < 0.5 || y0 > fromY) continue;
        if (ray.intersectTriangle(t.a, t.b, t.c, false, hitP) && hitP.y > best) best = hitP.y;
      }
    }
    return best;
  }
  // the furniture's boxes on the floor: { x, z, c, s, hw, hd }
  const boxes = new Map();   // slot id -> [box, ...]
  function pushOut(body, { radius = 0.26, balls = [0.62, 1.3] } = {}) {
    let movedAny = false;
    for (let pass = 0; pass < 3; pass++) {
      let moved = false;
      for (const h of balls) {
        ball.set(body.x, body.y + h, body.z);
        for (const { t, y0, y1, ny } of near(body.x, body.z, radius + 0.1)) {
          if (Math.abs(ny) > 0.5 || y0 > ball.y + radius || y1 < ball.y - radius) continue;
          t.closestPointToPoint(ball, cp);
          const dx = ball.x - cp.x, dz = ball.z - cp.z, dy = ball.y - cp.y, d = Math.hypot(dx, dy, dz);
          if (!(d < radius)) continue;
          const flat = Math.hypot(dx, dz); if (flat < 1e-4) continue;
          const push = Math.sqrt(radius * radius - dy * dy) - flat + 0.002;
          if (push <= 0) continue;
          body.x += dx / flat * push; body.z += dz / flat * push; ball.set(body.x, body.y + h, body.z); moved = movedAny = true;
        }
      }
      // the furniture: out of each box, the shortest way
      for (const list of boxes.values()) for (const b of list) {
        const dx = body.x - b.x, dz = body.z - b.z, lx = b.c * dx - b.s * dz, lz = b.s * dx + b.c * dz;
        const qx = Math.max(-b.hw, Math.min(b.hw, lx)), qz = Math.max(-b.hd, Math.min(b.hd, lz));
        const ox = lx - qx, oz = lz - qz, d = Math.hypot(ox, oz);
        if (d >= radius) continue;
        if (d < 1e-5) {   // (the middle is inside the box: out through the nearest side)
          let nx = lx, nz = lz;
          if (b.hw - Math.abs(lx) < b.hd - Math.abs(lz)) nx = (Math.sign(lx) || 1) * (b.hw + radius); else nz = (Math.sign(lz) || 1) * (b.hd + radius);
          body.x = b.x + b.c * nx + b.s * nz; body.z = b.z - b.s * nx + b.c * nz; moved = movedAny = true; continue;
        }
        const k = (radius - d + 0.002) / d, px = ox * k, pz = oz * k;
        body.x += b.c * px + b.s * pz; body.z += -b.s * px + b.c * pz; moved = movedAny = true;
      }
      if (!moved) break;
    }
    return movedAny;
  }
  // a point on a wall (the cabin's frame): from `at`, back into the room a little, then along dir until a wall
  const caster = new THREE.Raycaster(), wv = new THREE.Vector3(), wd = new THREE.Vector3();
  function wallPoint(at, dir) {
    const d = new THREE.Vector3(...dir).normalize(), from = new THREE.Vector3(at[0], at[1], at[2]).addScaledVector(d, -1.2);
    caster.set(toWorld(from.x, from.y, from.z, wv), wd.copy(d).applyQuaternion(group.quaternion)); caster.far = 3;
    const hit = caster.intersectObjects(statMeshes, false)[0];
    return hit ? toLocal(hit.point.x, hit.point.y, hit.point.z) : new THREE.Vector3(at[0], at[1], at[2]);
  }

  // ── THE PORCH: its floor's height (the lowest of a row of spots along it: a crate or a barrel stands higher) and
  // the foot of its steps, on the door's line ──
  const porchY = Math.min(...[-1.5, -0.5, 0.5, 1.5].map((x) => floorUnder(x, 1.7, 2)).filter((y) => y > 0.2), 0.82);
  let stepsFoot = 3.1;
  for (let z = 1.2; z < 4.5; z += 0.05) { if (floorUnder(0.24, z, 2) < 0.08) { stepsFoot = z; break; } }
  const porch = { y: porchY, front: 2.6, foot: stepsFoot, doorX: 0.24 };

  // ── THE DOOR ──
  const OPEN_DEG = 92;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function setDoor(t) { hinge.rotation.y = THREE.MathUtils.degToRad(OPEN_DEG * ease(Math.max(0, Math.min(1, t)))); moveDoorTris(); }

  // ── THE FURNISHINGS ──
  const files = new Map();     // file -> Promise<template scene>
  const TINT = { chair: 0x9a7150 };   // the chairs come painted white: stained to a warm wood brown to match the room
  const loadFile = (file) => {
    if (!files.has(file)) files.set(file, loader.loadAsync(`${base}models/furniture/${file}.glb`).then((g) => {
      const s = g.scene; s.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; for (const m of [].concat(o.material)) { for (const t of [m.map, m.normalMap]) if (t) t.anisotropy = Math.min(8, maxAniso); if (TINT[file]) m.color.setHex(TINT[file]); } } });
      s.updateMatrixWorld(true); s.userData.box = new THREE.Box3().setFromObject(s); return s;
    }));
    return files.get(file);
  };
  // one placed copy of a file, fitted to its spot: in a group stood at the spot (or hung on the wall), turned by rot
  async function placeFile(spec, wallPiece) {
    const tpl = await loadFile(spec.file), b = tpl.userData.box, size = b.getSize(new THREE.Vector3()), mid = b.getCenter(new THREE.Vector3());
    const s = spec.fitH ? spec.fitH / size.y : spec.fit ? spec.fit / Math.max(size.x, size.z) : 1;
    const piece = tpl.clone(); piece.scale.setScalar(s);
    if (wallPiece) piece.position.set(-mid.x * s, -mid.y * s, -b.min.z * s); else piece.position.set(-mid.x * s, -b.min.y * s, -mid.z * s);
    const g = new THREE.Group(); g.add(piece); return g;
  }
  function stand(g, spec) {
    const [x, y, z] = spec.at;
    if (spec.wall) {
      const p = wallPoint(spec.at, spec.wall), w = spec.wall;
      g.position.set(p.x - w[0] * 0.01, p.y, p.z - w[2] * 0.01); g.rotation.set(0, Math.atan2(-w[0], -w[2]), 0);
    } else {
      g.position.set(x, y == null ? floorUnder(x, z, 1.6) : y, z); g.rotation.set(0, THREE.MathUtils.degToRad(spec.rot || 0), 0);
    }
  }
  const boxOf = (spec) => { const a = THREE.MathUtils.degToRad(spec.rot || 0); return { x: spec.at[0], z: spec.at[2], c: Math.cos(a), s: Math.sin(a), hw: spec.box[0] / 2, hd: spec.box[1] / 2 }; };
  const made = (o) => { o.userData.made = true; return o; };   // (made here: freed on its own; a file's copies share the file's)
  const BED_SPOTS = SLOT.dogbeds.looks.map(([x, , z], i) => ({ x, z, rot: [0.5, 0.2, -0.3][i] }));
  // a slot's piece: a group with everything it shows (made in code, or its files placed); built once, kept
  const pieces = new Map();    // id -> Promise<group>
  function pieceOf(id, opts = {}) {
    const k = id + (id === 'dogbeds' ? ':' + opts.dogs : '');
    if (pieces.has(k)) return pieces.get(k);
    const spec = SLOT[id];
    const p = (async () => {
      const g = new THREE.Group(); g.name = 'slot-' + id;
      if (spec.made === 'lanterns') {
        // the lantern model (cut from camp 3's tent) hung at each spot, 0.34 m tall, its glass round the flame; the lamp,
        // the glow and the cord made in code. Its tin glows a little warm from the flame inside.
        const tpl = spec.file ? await loadFile(spec.file) : null;
        g.add(made(makePiece('lanterns', { at: spec.looks, body: !tpl })));
        if (tpl) {
          tpl.traverse((o) => { if (o.isMesh && !o.material.userData.warm) { o.material.userData.warm = true; o.material.emissive.set(0xff9a40); o.material.emissiveMap = o.material.map; o.material.emissiveIntensity = 0.35; } });
          const b = tpl.userData.box, k = 0.34 / (b.max.y - b.min.y), mid = b.getCenter(new THREE.Vector3());
          for (const [x, y, z] of spec.looks) { const c = tpl.clone(); c.scale.setScalar(k); c.position.set(x - mid.x * k, y - 0.156 - b.min.y * k, z - mid.z * k); g.add(c); }
        }
      } else if (spec.made === 'dogbeds') {
        const n = Math.max(1, Math.min(BED_SPOTS.length, opts.dogs || 1)), tints = ['#8e3b30', '#3f5a78', '#5f6e3a'];
        for (let i = 0; i < n; i++) { const b = made(makePiece('dogbed', { tint: tints[i] })), s = BED_SPOTS[i]; b.position.set(s.x, floorUnder(s.x, s.z, 1.6), s.z); b.rotation.y = s.rot; g.add(b); }
      } else if (spec.made === 'rifles') {
        // the rifle and the shotgun (models/guns, as the riders' own: guns.json says each one's scale and which way its
        // barrel points), laid along the rack, muzzles opposite ways, each centred on it
        const facts = await fetch(`${base}models/guns/guns.json`).then((r) => r.json()).then((j) => j.guns).catch(() => null);
        const guns = facts && (await Promise.all(['Rifle', 'Shotgun'].map(async (name, i) => {
          const f = facts[name], gun = (await loader.loadAsync(`${base}models/guns/${f.file}`)).scene;
          gun.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.frustumCulled = false; } });
          const turn = new THREE.Group(); turn.add(gun); gun.scale.setScalar(f.scale);
          turn.rotation.y = Math.atan2(-f.forward[0], -f.forward[2]) + (i ? -1 : 1) * Math.PI / 2;   // (barrel along -x, then +x)
          turn.updateMatrixWorld(true); const mid = new THREE.Box3().setFromObject(turn).getCenter(new THREE.Vector3());
          const lay = new THREE.Group(); turn.position.sub(mid); lay.add(turn); return lay;
        })).catch(() => null));
        const m = made(makePiece('rifles', { guns })); stand(m, spec); g.add(m);
      } else if (spec.made) { const m = made(makePiece(spec.made)); stand(m, spec); g.add(m); }
      else { const m = await placeFile(spec, !!spec.wall); stand(m, spec); g.add(m); }
      if (spec.also) { const m = made(makePiece(spec.also, { scale: spec.fitH || 1 })); stand(m, spec); g.add(m); }
      for (const ex of spec.extra || []) { const m = await placeFile(ex, false); stand(m, ex); g.add(m); }
      // (made in code: slimmed to a few shapes; the room's things cast no shadows: the valley's sun only reaches in
      // through the windows, and their shadows would double their draws)
      { const mk = []; g.traverse((o) => { if (o.userData.made) mk.push(o); }); mk.forEach(slim); }
      if (id !== 'porch') { litTree(g); g.traverse((o) => { if (o.isMesh) o.castShadow = false; }); }
      g.userData.ticks = []; g.userData.lamps = [];
      g.traverse((o) => { if (o.tick) g.userData.ticks.push(o.tick); if (o.userData.lamp) g.userData.lamps.push(o); });
      return g;
    })();
    pieces.set(k, p); return p;
  }
  const shown = new Map();     // id -> group in the cabin
  let owned = [], dogsN = 0, ghostId = null, ghostObj = null, gen = 0;
  // the see-through look: a pale warm glass, cut to the piece's own outline where its picture has one (the rug's oval)
  const ghostMats = new Map(), ghostMat = (m) => {
    const cut = m && m.alphaTest > 0 && m.map ? m.map : null;
    if (!ghostMats.has(cut)) ghostMats.set(cut, new THREE.MeshBasicMaterial({ color: 0xffd9a0, transparent: true, opacity: 0.32, depthWrite: false, alphaMap: null, map: cut, alphaTest: cut ? 0.1 : 0 }));
    return ghostMats.get(cut);
  };
  async function furnish(list, { dogs = 0 } = {}) {
    owned = list.slice(); dogsN = dogs; const my = ++gen;
    for (const s of SLOTS) {
      const want = owned.includes(s.id);
      if (!want) { const g = shown.get(s.id); if (g) { g.removeFromParent(); shown.delete(s.id); } boxes.delete(s.id); continue; }
      const g = await pieceOf(s.id, { dogs });
      if (my !== gen) return;                       // (a newer call took over)
      const was = shown.get(s.id); if (was && was !== g) was.removeFromParent();
      if (!g.parent) (s.id === 'porch' ? group : inner).add(g); shown.set(s.id, g);   // (the porch's rockers are outside: always drawn)
      boxes.set(s.id, [s, ...(s.extra || [])].filter((x) => x.box).map(boxOf));
    }
    lamps.length = 0; for (const g of shown.values()) lamps.push(...g.userData.lamps);
  }
  async function ghost(id) {
    if (id === ghostId) return; ghostId = id;
    if (ghostObj) { ghostObj.removeFromParent(); ghostObj = null; }
    if (!id || owned.includes(id)) return;
    const g = await pieceOf(id, { dogs: Math.max(1, dogsN) });
    if (ghostId !== id) return;
    const c = g.clone(true);
    c.traverse((o) => { if (o.isMesh) { o.material = ghostMat([].concat(o.material)[0]); o.castShadow = false; o.receiveShadow = false; } if (o.isLight || o.isSprite) o.visible = false; });
    ghostObj = c; inner.add(c);
  }
  // a piece just bought grows into place
  const pops = [];
  function pop(id) { const g = shown.get(id); if (g) pops.push({ g, t: 0 }); }

  // ── THE KEEPSAKES ──
  const kept = new Map();      // job -> { key, g }
  function keepsakes(list) {
    const table = owned.includes('table');
    const keyOf = (job, tier) => tier + (KEEPSAKE_SPOTS[job] && KEEPSAKE_SPOTS[job].table ? (table ? ':table' : ':crate') : '');
    const want = new Map(list.map((k) => [k.job, keyOf(k.job, k.tier)]));
    for (const [job, k] of kept) if (want.get(job) !== k.key) { disposeTree(k.g); kept.delete(job); }
    for (const k of list) {
      const spot = KEEPSAKE_SPOTS[k.job];
      if (kept.has(k.job) || !spot) continue;
      // (one that stands on the table sits on a crate as high as the table till there is one)
      const g = makeKeepsake(k.job, k.tier, spot.table ? { raise: table ? 0 : spot.table } : undefined); if (!g) continue;
      if (spot.wall) stand(g, spot);
      else if (spot.table) { const [x, , z] = spot.at; g.position.set(x, floorUnder(x, z, 1.6) + (table ? spot.table : 0), z); g.rotation.set(0, THREE.MathUtils.degToRad(spot.rot || 0), 0); }
      else { g.position.set(spot.at[0], floorUnder(spot.at[0], spot.at[2], 1.6), spot.at[2]); g.rotation.set(-0.18, THREE.MathUtils.degToRad(spot.rot || 0), 0); }
      slim(g); g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
      litTree(g); inner.add(g); kept.set(k.job, { key: keyOf(k.job, k.tier), g });
    }
  }

  // ── THE TOWN'S OWN CABIN MODEL at the spot: hidden while this one stands there (it may still be loading) ──
  const townCabin = () => { const o = W.V && W.V.TOWN && W.V.TOWN.village && W.V.TOWN.village.objs && W.V.TOWN.village.objs.get('cabin'); return o && o.inner; };
  let hidTown = null;
  function hideTown() { const t = townCabin(); if (t && t !== hidTown) { t.visible = false; hidTown = t; } }
  hideTown();

  // ── EACH FRAME ──
  const lamps = [], lw = new THREE.Vector3(), fillNow = new THREE.Color();
  let clock = 0, nearOn = true, townT = 0;
  function update(dt, { night = 0 } = {}) {
    clock += dt;
    if ((townT -= dt) < 0) { townT = 1; hideTown(); }
    // the bounced light: more of it before there are lanterns; down with the daylight at night
    const n = Math.max(0, Math.min(1, night || 0)), day = 1 - (1 - LIGHT.fillNight) * n;
    fillNow.setRGB(...(owned.includes('lanterns') ? LIGHT.fill : LIGHT.fillBare)).multiplyScalar(day);
    U.insideFill.value.copy(fillNow);
    U.insideSky.value = LIGHT.skyInside * (1 - LIGHT.skyNight * n);
    if (!nearOn) return;
    for (const g of shown.values()) for (const f of g.userData.ticks || []) f(dt, clock);
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i]; p.t += dt; const k = Math.min(1, p.t / 0.45), s = k < 1 ? 0.6 + 0.4 * (1 - Math.pow(1 - k, 3)) + 0.08 * Math.sin(k * Math.PI) : 1;
      p.g.scale.setScalar(s); if (k >= 1) pops.splice(i, 1);
    }
    // the lamps' light: where each lamp is in the valley, and how bright now (its flicker). The valley brightens the
    // whole picture at night (its exposure goes up to about 2.2, so moonlit nights are bright): the lamps are tuned for
    // the day's exposure of 1, so they are turned down by as much, or they'd glare white
    const ex = 1 / Math.max(1, renderer.toneMappingExposure || 1);
    for (let i = 0; i < N; i++) {
      const L = lamps[i];
      if (!L) { U.lampCol.value[i].set(0, 0, 0); continue; }
      L.getWorldPosition(lw); U.lampAt.value[i].copy(lw);
      U.lampCol.value[i].set(L.color.r, L.color.g, L.color.b).multiplyScalar(L.intensity * ex);
      U.lampFall.value[i].set(L.distance || 9, L.decay || 1.4);
    }
  }
  function setNear(on) {
    if (on === nearOn) return; nearOn = on; inner.visible = on;
    if (!on) for (const v of U.lampCol.value) v.set(0, 0, 0);
  }

  function dispose() {
    if (hidTown) hidTown.visible = true;
    if (ghostObj) ghostObj.removeFromParent();
    for (const m of ghostMats.values()) m.dispose(); ghostMats.clear();
    for (const k of kept.values()) disposeTree(k.g); kept.clear();
    // the pieces (their own shapes; the files' templates are freed below, once)
    Promise.all([...pieces.values()]).then((gs) => {
      for (const g of gs) { const mine = []; g.traverse((o) => { if (o.userData.made) mine.push(o); }); for (const m of mine) disposeTree(m); g.removeFromParent(); }
    }).catch(() => {});
    Promise.all([...files.values()]).then((ts) => { for (const t of ts) disposeTree(t); }).catch(() => {});
    pieces.clear(); files.clear(); shown.clear(); boxes.clear();
    group.removeFromParent();
    // (the model's shapes and pictures are the loaded file's, shared with a later ride: kept)
    disposeShared();
  }

  return {
    group, inner, cabin, hinge, lit, floorUnder, pushOut, setDoor, furnish, ghost, pop, keepsakes, update, dispose, wallPoint, toWorld, toLocal,
    near: setNear, porch, yaw: pl.rot, uniforms: U,
    bedSpots: (n) => BED_SPOTS.slice(0, Math.max(1, n)).map((s) => ({ ...s, y: floorUnder(s.x, s.z, 1.6) })),
    get owned() { return owned.slice(); }, get shown() { return [...shown.keys()]; }, get nearOn() { return nearOn; }, boxes,
  };
}
