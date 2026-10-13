// THE CABIN'S INSIDE: its own little scene (models/town/cabin_inside.glb, the walk-in cabin of tests/cabin.html, with
// the same light), drawn instead of the valley while the player is in it, and everything that stands in it: the pieces
// bought for its fixed slots (slots.js), the belt-buckle keepsakes, the dogs (homedogs.js, added by cabin.js).
//
// The light, as in tests/cabin.html: a low late-day sun from the front right, casting shadows, so the room is darker
// than outdoors except where it shines in through the windows and the door; the sky's light on everything inside turned
// down (it can't reach in there much), and a faint warm light from every side (the light bounced round the room), a
// little stronger before there are lanterns, so a bare cabin isn't black. Bought lanterns and the stove add their own
// warm lights (a PointLight each, affordable as only this one room is drawn).
// Through the windows: a plain meadow, a line of trees far off and the sky (the valley itself isn't drawn in here).
//
// Walls stop you as in tests/cabin.html: two balls (knee and chest high) are pushed sideways out of every nearby wall-
// like triangle, and the floor under you is found by rays straight down; the furniture is a box on the floor each.
//
//   const R = await makeInterior({ renderer, tier, base })   base: the game's folder URL (for models/)
//   R.scene, R.ready
//   R.floorUnder(x, z, fromY)            the floor's height under a spot (the highest surface no higher than fromY)
//   R.pushOut(body, { radius, balls })   pushes body { x, y, z } out of the walls and the furniture; -> true if it moved
//   R.setDoor(t)                         the door, 0 shut .. 1 open
//   R.furnish(owned, { dogs })           shows the pieces owned (slot ids) and hides the rest; dogs: how many dog beds
//   R.ghost(id | null)                   a see-through look at a slot's piece, in its place, before it is bought
//   R.pop(id)                            a piece just bought grows into place
//   R.keepsakes([{ job, tier }])          the keepsakes earned
//   R.bedSpots(n)                        where the dog beds are: [{ x, y, z, rot }]
//   R.lit(material)                      gives a material the inside light (sky turned down, the bounced warm light)
//   R.update(dt)                         the flames flicker, pieces settle
//   R.dispose()                          frees everything
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { SLOTS, SLOT, KEEPSAKE_SPOTS } from './slots.js';
import { makePiece, makeKeepsake, disposeTree, disposeShared } from './pieces.js';

export const LIGHT = {
  skyInside: 0.6,                         // the sky's light inside (a share of it)
  fill: [0.55, 0.42, 0.3],                // the bounced warm light with lanterns lit (they light the room themselves)
  fillBare: [1.3, 1.0, 0.72],             // ... and before there are any (the window light, bounced)
  sun: 3.4, sky: 1.6,
  shadowSize: { potato: 1024, normal: 2048, gaming: 4096 },
};
const CELL = 0.5;

export async function makeInterior({ renderer, tier = 'normal', base = new URL('../../', import.meta.url).href }) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x9cc0e0);
  scene.fog = new THREE.Fog(0x9cc0e0, 60, 220);
  const own = new Set();                    // everything made here, freed in dispose (groups and their contents)
  const keep = (o) => { own.add(o); return o; };

  // ── OUTSIDE THE WINDOWS: a meadow, trees far off, the sky ──
  const ground = keep(new THREE.Mesh(new THREE.CircleGeometry(200, 48), new THREE.MeshStandardMaterial({ color: 0x6f7a45, roughness: 1 })));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
  const treeTex = (() => {      // a ragged line of dark green trees along the bottom of a strip, clear above
    const c = document.createElement('canvas'); c.width = 1024; c.height = 128; const x = c.getContext('2d');
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 160; i++) { const px = rnd() * 1024, h = 40 + rnd() * 70, w = 10 + rnd() * 18; x.fillStyle = `rgb(${40 + rnd() * 20},${62 + rnd() * 25},${38 + rnd() * 15})`; x.beginPath(); x.moveTo(px - w, 128); x.lineTo(px, 128 - h); x.lineTo(px + w, 128); x.fill(); }
    const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; t.repeat.set(3, 1); return t;
  })();
  const trees = keep(new THREE.Mesh(new THREE.CylinderGeometry(120, 120, 22, 48, 1, true), new THREE.MeshBasicMaterial({ map: treeTex, transparent: true, alphaTest: 0.5, side: THREE.BackSide, fog: true })));
  trees.position.y = 10; scene.add(trees);

  const sky = new THREE.HemisphereLight(0xcfe2ff, 0x6b5a40, LIGHT.sky); scene.add(sky);
  const sun = new THREE.DirectionalLight(0xffe6c4, LIGHT.sun);
  sun.position.set(7, 5.5, 7.5); sun.target.position.set(0, 1, -1); scene.add(sun, sun.target);
  sun.castShadow = true; const sz = LIGHT.shadowSize[tier] || 2048; sun.shadow.mapSize.set(sz, sz);
  const sc = sun.shadow.camera; sc.left = -7; sc.right = 7; sc.top = 7; sc.bottom = -7; sc.near = 1; sc.far = 30;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.03;

  // the inside light: the sky's light turned down and a faint warm light from every side
  const insideSky = { value: LIGHT.skyInside }, insideFill = { value: new THREE.Color(...LIGHT.fillBare) };
  const patched = new WeakSet();
  function lit(m) {
    if (!m || patched.has(m) || !m.isMeshStandardMaterial) return m;
    patched.add(m);
    m.onBeforeCompile = (sh) => {
      sh.uniforms.insideSky = insideSky; sh.uniforms.insideFill = insideFill;
      sh.fragmentShader = 'uniform float insideSky;\nuniform vec3 insideFill;\n' + sh.fragmentShader.replace('#include <lights_fragment_end>', 'irradiance = irradiance * insideSky + insideFill;\n#include <lights_fragment_end>');
    };
    m.needsUpdate = true;
    return m;
  }
  const litTree = (o) => o.traverse((c) => { if (c.isMesh) for (const m of [].concat(c.material)) lit(m); });

  // ── THE CABIN ──
  const loader = new GLTFLoader();
  const gltf = await loader.loadAsync(base + 'models/town/cabin_inside.glb');
  const cabin = keep(gltf.scene); scene.add(cabin);
  const hinge = cabin.getObjectByName('DoorHinge');
  if (!hinge) throw new Error('cabin_inside.glb has no DoorHinge');
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  cabin.traverse((o) => {
    if (!o.isMesh) return;
    o.castShadow = o.receiveShadow = true;
    for (const m of [].concat(o.material)) {
      for (const t of [m.map, m.normalMap]) if (t) t.anisotropy = maxAniso;
      if (m.name.startsWith('inside')) lit(m);
    }
  });
  cabin.updateMatrixWorld(true);

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
  function moveDoorTris() {
    hinge.updateMatrixWorld(true);
    doorRest.forEach((t, k) => { const d = doorTris[k]; d.t.a.copy(t.a).applyMatrix4(hinge.matrixWorld); d.t.b.copy(t.b).applyMatrix4(hinge.matrixWorld); d.t.c.copy(t.c).applyMatrix4(hinge.matrixWorld); fit(d); });
  }
  moveDoorTris();
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
        let ox = lx - qx, oz = lz - qz, d = Math.hypot(ox, oz);
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
  // a point on a wall: from `at`, back into the room a little, then along dir until a wall of the cabin
  const caster = new THREE.Raycaster();
  function wallPoint(at, dir) {
    const d = new THREE.Vector3(...dir).normalize(), from = new THREE.Vector3(at[0], at[1], at[2]).addScaledVector(d, -1.2);
    caster.set(from, d); caster.far = 3;
    const hit = caster.intersectObjects(statMeshes, false)[0];
    return hit ? hit.point : new THREE.Vector3(at[0], at[1], at[2]);
  }

  // ── THE DOOR ──
  const OPEN_DEG = 92;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  function setDoor(t) { hinge.rotation.y = THREE.MathUtils.degToRad(OPEN_DEG * ease(Math.max(0, Math.min(1, t)))); moveDoorTris(); }

  // ── THE FURNISHINGS ──
  const files = new Map();     // file -> Promise<template scene>
  const loadFile = (file) => {
    if (!files.has(file)) files.set(file, loader.loadAsync(`${base}models/furniture/${file}.glb`).then((g) => {
      const s = g.scene; s.traverse((o) => { if (o.isMesh) { o.castShadow = o.receiveShadow = true; for (const m of [].concat(o.material)) for (const t of [m.map, m.normalMap]) if (t) t.anisotropy = Math.min(8, maxAniso); } });
      s.updateMatrixWorld(true); s.userData.box = new THREE.Box3().setFromObject(s); return s;
    }));
    return files.get(file);
  };
  // one placed copy of a file, fitted to its spot: in a group stood at the spot (or hung on the wall), turned by rot
  async function placeFile(spec, wallPiece) {
    const tpl = await loadFile(spec.file), b = tpl.userData.box, size = b.getSize(new THREE.Vector3()), mid = b.getCenter(new THREE.Vector3());
    const s = spec.fitH ? spec.fitH / size.y : spec.fit ? spec.fit / Math.max(size.x, size.z) : 1;
    const inner = tpl.clone(); inner.scale.setScalar(s);
    if (wallPiece) inner.position.set(-mid.x * s, -mid.y * s, -b.min.z * s); else inner.position.set(-mid.x * s, -b.min.y * s, -mid.z * s);
    const g = new THREE.Group(); g.add(inner); return g;
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
      if (spec.made === 'lanterns') g.add(made(makePiece('lanterns', { at: spec.looks })));
      else if (spec.made === 'dogbeds') {
        const n = Math.max(1, Math.min(BED_SPOTS.length, opts.dogs || 1)), tints = ['#8e3b30', '#3f5a78', '#5f6e3a'];
        for (let i = 0; i < n; i++) { const b = made(makePiece('dogbed', { tint: tints[i] })), s = BED_SPOTS[i]; b.position.set(s.x, floorUnder(s.x, s.z, 1.6), s.z); b.rotation.y = s.rot; g.add(b); }
      } else if (spec.made) { const m = made(makePiece(spec.made)); stand(m, spec); g.add(m); }
      else { const m = await placeFile(spec, !!spec.wall); stand(m, spec); g.add(m); }
      if (spec.also) { const m = made(makePiece(spec.also, { scale: spec.fitH || 1 })); stand(m, spec); g.add(m); }
      for (const ex of spec.extra || []) { const m = await placeFile(ex, false); stand(m, ex); g.add(m); }
      if (id !== 'porch') litTree(g);
      g.userData.ticks = []; g.traverse((o) => { if (o.tick) g.userData.ticks.push(o.tick); });
      return g;
    })();
    pieces.set(k, p); return p;
  }
  const shown = new Map();     // id -> group in the scene
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
      if (!g.parent) scene.add(g); shown.set(s.id, g);
      boxes.set(s.id, [s, ...(s.extra || [])].filter((x) => x.box).map(boxOf));
    }
    insideFill.value.setRGB(...(owned.includes('lanterns') ? LIGHT.fill : LIGHT.fillBare));
  }
  async function ghost(id) {
    if (id === ghostId) return; ghostId = id;
    if (ghostObj) { ghostObj.removeFromParent(); ghostObj = null; }
    if (!id || owned.includes(id)) return;
    const g = await pieceOf(id, { dogs: Math.max(1, dogsN) });
    if (ghostId !== id) return;
    const c = g.clone(true);
    c.traverse((o) => { if (o.isMesh) { o.material = ghostMat([].concat(o.material)[0]); o.castShadow = false; o.receiveShadow = false; } if (o.isLight || o.isSprite) o.visible = false; });
    ghostObj = c; scene.add(c);
  }
  // a piece just bought grows into place
  const pops = [];
  function pop(id) { const g = shown.get(id); if (g) pops.push({ g, t: 0 }); }

  // ── THE KEEPSAKES ──
  const kept = new Map();      // job -> { tier, g }
  function keepsakes(list) {
    const table = owned.includes('table');
    const key = (job, tier) => tier + (KEEPSAKE_SPOTS[job] && KEEPSAKE_SPOTS[job].table ? (table ? ':table' : ':crate') : '');
    const want = new Map(list.map((k) => [k.job, key(k.job, k.tier)]));
    for (const [job, k] of kept) if (want.get(job) !== k.key) { disposeTree(k.g); kept.delete(job); }
    for (const k of list) {
      const spot = KEEPSAKE_SPOTS[k.job];
      if (kept.has(k.job) || !spot) continue;
      // (one that stands on the table sits on a crate as high as the table till there is one)
      const g = makeKeepsake(k.job, k.tier, spot.table ? { raise: table ? 0 : spot.table } : undefined); if (!g) continue;
      if (spot.wall) stand(g, spot);
      else if (spot.table) { const [x, , z] = spot.at; g.position.set(x, floorUnder(x, z, 1.6) + (table ? spot.table : 0), z); g.rotation.set(0, THREE.MathUtils.degToRad(spot.rot || 0), 0); }
      else { g.position.set(spot.at[0], floorUnder(spot.at[0], spot.at[2], 1.6), spot.at[2]); g.rotation.set(-0.18, THREE.MathUtils.degToRad(spot.rot || 0), 0); }
      litTree(g); scene.add(g); kept.set(k.job, { key: key(k.job, k.tier), g });
    }
  }

  let clock = 0;
  function update(dt) {
    clock += dt;
    for (const g of shown.values()) for (const f of g.userData.ticks || []) f(dt, clock);
    for (let i = pops.length - 1; i >= 0; i--) {
      const p = pops[i]; p.t += dt; const k = Math.min(1, p.t / 0.45), s = k < 1 ? 0.6 + 0.4 * (1 - Math.pow(1 - k, 3)) + 0.08 * Math.sin(k * Math.PI) : 1;
      p.g.scale.setScalar(s); if (k >= 1) pops.splice(i, 1);
    }
  }

  function dispose() {
    if (ghostObj) ghostObj.removeFromParent();
    for (const m of ghostMats.values()) m.dispose(); ghostMats.clear();
    for (const k of kept.values()) disposeTree(k.g); kept.clear();
    // the pieces (their own shapes; the files' templates are freed below, once)
    Promise.all([...pieces.values()]).then((gs) => {
      for (const g of gs) { const made = []; g.traverse((o) => { if (o.userData.made) made.push(o); }); for (const m of made) disposeTree(m); g.removeFromParent(); }
    }).catch(() => {});
    Promise.all([...files.values()]).then((ts) => { for (const t of ts) disposeTree(t); }).catch(() => {});
    pieces.clear(); files.clear(); shown.clear(); boxes.clear();
    for (const o of own) disposeTree(o);
    treeTex.dispose();
    sun.shadow.dispose();
    disposeShared();
  }

  return {
    scene, cabin, hinge, lit, floorUnder, pushOut, setDoor, furnish, ghost, pop, keepsakes, update, dispose, wallPoint,
    bedSpots: (n) => BED_SPOTS.slice(0, Math.max(1, n)).map((s) => ({ ...s, y: floorUnder(s.x, s.z, 1.6) })),
    get owned() { return owned.slice(); }, get shown() { return [...shown.keys()]; }, boxes,
  };
}
