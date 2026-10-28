// THE PLAYER'S CABIN IN THE VALLEY: a cabin design built in code like the town's other buildings (world/objects/
// codebuildings.js: the layout's 'cabin', the two-room log house unless its item names another, PLAYER_CABIN), walked into
// as any building is. This adds what is the player's own: the pieces bought for its slots (slots.js), the belt-buckle
// keepsakes, the dogs at home (homedogs.js, added by cabin.js), all placed by the design's own rooms and anchors
// (layout.js). Everything here is in the building's own frame (metres; its front toward +z; the floor at its anchors' floor).
//
// THE LIGHT on the pieces: the valley's own, with the sky's light turned down indoors and a faint warm light from every
// side (bounced round the room), and the lanterns' and the stove's light worked out by the pieces themselves (the `lit`
// patch: up to three lamps, from the pieces' lamp markers, pieces.js lampOf). Not real lights: a PointLight in the valley
// would make every lit thing there costlier. (The cabin's own walls are lit as the town's buildings are.)
//
// FAR OFF, or with the building's inside not to be seen (its doors shut, the camera outside), the pieces inside aren't
// drawn. The bought furniture stands in a walker's way (CODE.blockers), as the design's own does.
//
//   const R = await makeHome({ W, renderer, base })   base: the game's folder URL (for models/)
//   R.group                              the pieces' frame in the valley (the building's own); R.inner: the inside's pieces
//   R.code, R.layout                     the code-built building (codebuild.js) and where its things go (layout.js)
//   R.toWorld(x, y, z, out) / R.toLocal(x, y, z, out)   the cabin's own frame <-> the valley's (Vector3 out)
//   R.yaw                                the cabin's turn in the valley (radians; a heading in its frame + yaw = the valley's)
//   R.floorUnder(x, z)                   the floor's height under a spot (its frame: the floor, the porch, or the ground)
//   R.pushOut(body, { radius })          pushes body { x, y, z } (its frame) out of the walls and the furniture; -> moved
//   R.inside(x, z)                       a point (its frame) is in one of its rooms
//   R.furnish(owned, { dogs })           shows the pieces owned (slot ids) and hides the rest; dogs: how many dog beds
//   R.spec(id)                           a slot as it stands in this cabin: slots.js's piece, at layout.js's place
//   R.ghost(id | null)                   a see-through look at a slot's piece, in its place, before it is bought
//   R.pop(id)                            a piece just bought grows into place
//   R.keepsakes([{ job, tier }])         the keepsakes earned; R.keepLook(job) -> where one is looked at
//   R.bedSpots(n)                        where the dog beds are: [{ x, y, z, rot }] (its frame)
//   R.lit(material)                      gives a material the inside light
//   R.near(on)                           the inside's pieces drawn (true) or left out (far off)
//   R.update(dt, { night })              the flames flicker, pieces settle, the lamps' light follows them; night: 0..1
//   R.openings()                         points (its frame) round its windows' glass and its doorways: where the valley
//                                        can be seen from inside (cabin.js leaves the valley undrawn while none is in view)
//   R.portals()                          the same as rectangles: [{ c, corners: [4 x [x, y, z]], n }] (its frame; n: out),
//                                        the windows' panes (each window's glass, from its pane shapes) and the doorways
//   R.stale()                            true once the building has been built again (the Town Lab's New look): make anew
//   R.dispose()
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { SLOTS } from './slots.js';
import { cabinLayout } from './layout.js';
import { makePiece, makeKeepsake, disposeTree, disposeShared } from './pieces.js';
import { isPlayersCabin } from '../../world/objects/codebuildings.js';

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
const loader = new GLTFLoader();

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
  const CODE = W.V && W.V.CODE;
  if (!CODE) throw new Error('no code-built buildings');
  await CODE.ready;
  const o = [...W.V.TOWN.village.objs.values()].find((q) => q.code && isPlayersCabin(q.it));
  if (!o) throw new Error('no player\'s cabin built');
  const B = o.code, Lay = cabinLayout(B.B.anchors);
  const group = new THREE.Group(); group.name = 'player-cabin';
  const inner = new THREE.Group(); inner.name = 'cabin-inside'; group.add(inner);
  B.group.add(group);
  const maxAniso = renderer.capabilities.getMaxAnisotropy();
  const SPEC = Object.fromEntries(SLOTS.map((s) => [s.id, { ...s, ...(Lay.slots[s.id] || {}), box: (Lay.slots[s.id] && 'box' in Lay.slots[s.id]) ? Lay.slots[s.id].box : s.box }]));
  const KEEP = Lay.keepsakes;

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


  // ── THE FRAME: the building's own, in the valley (its matrix again once a frame: the Town Lab can move it) ──
  const M = new THREE.Matrix4(), Mi = new THREE.Matrix4();
  const frame = () => { group.updateWorldMatrix(true, false); M.copy(group.matrixWorld); Mi.copy(M).invert(); };
  frame();
  const toWorld = (x, y, z, out = new THREE.Vector3()) => out.set(x, y, z).applyMatrix4(M);
  const toLocal = (x, y, z, out = new THREE.Vector3()) => out.set(x, y, z).applyMatrix4(Mi);
  const yawOf = () => Math.atan2(M.elements[8], M.elements[10]);
  const _w = new THREE.Vector3(), _l = new THREE.Vector3();
  // the floor (or the porch, or the ground) under a spot in its frame
  function floorUnder(x, z) { toWorld(x, 0, z, _w); return CODE.heightAt(_w.x, _w.z, W.heightAt) - M.elements[13]; }
  const inside = (x, z) => Lay.rooms.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
  // the furniture's boxes on the floor: { x, z, c, s, hw, hd } (slot id -> [box, ...]); they stop a walker (CODE.blockers)
  const boxes = new Map();
  const inBox = (b, x, z, r) => { const dx = x - b.x, dz = z - b.z, lx = b.c * dx - b.s * dz, lz = b.s * dx + b.c * dz; return Math.abs(lx) < b.hw + r && Math.abs(lz) < b.hd + r; };
  const blocker = (x, z) => { if (!boxes.size) return false; toLocal(x, 0, z, _l); for (const list of boxes.values()) for (const b of list) if (inBox(b, _l.x, _l.z, 0.2)) return true; return false; };
  CODE.blockers.push(blocker);
  // a dog walking about inside: out of the furniture's boxes, and back from a wall toward the room's middle
  function pushOut(body, { radius = 0.26 } = {}) {
    let moved = false;
    for (const list of boxes.values()) for (const b of list) {
      const dx = body.x - b.x, dz = body.z - b.z, lx = b.c * dx - b.s * dz, lz = b.s * dx + b.c * dz;
      const qx = Math.max(-b.hw, Math.min(b.hw, lx)), qz = Math.max(-b.hd, Math.min(b.hd, lz)), ox = lx - qx, oz = lz - qz, d = Math.hypot(ox, oz);
      if (d >= radius) continue;
      if (d < 1e-5) { let nx = lx, nz = lz; if (b.hw - Math.abs(lx) < b.hd - Math.abs(lz)) nx = (Math.sign(lx) || 1) * (b.hw + radius); else nz = (Math.sign(lz) || 1) * (b.hd + radius); body.x = b.x + b.c * nx + b.s * nz; body.z = b.z - b.s * nx + b.c * nz; moved = true; continue; }
      const k = (radius - d + 0.002) / d, px = ox * k, pz = oz * k; body.x += b.c * px + b.s * pz; body.z += -b.s * px + b.c * pz; moved = true;
    }
    const r = Lay.rooms.find((q) => body.x > q.x0 - 0.5 && body.x < q.x1 + 0.5 && body.z > q.z0 - 0.5 && body.z < q.z1 + 0.5);
    if (r) { const cx = Math.max(r.x0 + radius, Math.min(r.x1 - radius, body.x)), cz = Math.max(r.z0 + radius, Math.min(r.z1 - radius, body.z)); if (cx !== body.x || cz !== body.z) { body.x = cx; body.z = cz; moved = true; } }
    return moved;
  }

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
    if (spec.wall) {   // (on the wall's face: layout.js puts `at` there; just off it, facing into the room)
      const w = spec.wall;
      g.position.set(x - w[0] * 0.03, y, z - w[2] * 0.03); g.rotation.set(0, Math.atan2(-w[0], -w[2]), 0);
    } else {
      g.position.set(x, y == null ? floorUnder(x, z) : y, z); g.rotation.set(0, THREE.MathUtils.degToRad(spec.rot || 0), 0);
    }
  }
  const boxOf = (spec) => { const a = THREE.MathUtils.degToRad(spec.rot || 0); return { x: spec.at[0], z: spec.at[2], c: Math.cos(a), s: Math.sin(a), hw: spec.box[0] / 2, hd: spec.box[1] / 2 }; };
  const made = (o) => { o.userData.made = true; return o; };   // (made here: freed on its own; a file's copies share the file's)
  const BED_SPOTS = Lay.bedSpots;
  // a slot's piece: a group with everything it shows (made in code, or its files placed); built once, kept
  const pieces = new Map();    // id -> Promise<group>
  function pieceOf(id, opts = {}) {
    const k = id + (id === 'dogbeds' ? ':' + opts.dogs : '');
    if (pieces.has(k)) return pieces.get(k);
    const spec = SPEC[id];
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
        for (let i = 0; i < n; i++) { const b = made(makePiece('dogbed', { tint: tints[i] })), s = BED_SPOTS[i]; b.position.set(s.x, floorUnder(s.x, s.z), s.z); b.rotation.y = s.rot; g.add(b); }
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
    for (const s0 of SLOTS) {
      const s = SPEC[s0.id], want = owned.includes(s.id);
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
    const keyOf = (job, tier) => tier + (KEEP[job] && KEEP[job].table ? (table ? ':table' : ':crate') : '');
    const want = new Map(list.map((k) => [k.job, keyOf(k.job, k.tier)]));
    for (const [job, k] of kept) if (want.get(job) !== k.key) { disposeTree(k.g); kept.delete(job); }
    for (const k of list) {
      const spot = KEEP[k.job];
      if (kept.has(k.job) || !spot) continue;
      // (one that stands on the table sits on a crate as high as the table till there is one)
      const g = makeKeepsake(k.job, k.tier, spot.table ? { raise: table ? 0 : spot.table } : undefined); if (!g) continue;
      if (spot.wall) stand(g, spot);
      else if (spot.table) { const [x, , z] = spot.at; g.position.set(x, floorUnder(x, z) + (table ? spot.table : 0), z); g.rotation.set(0, THREE.MathUtils.degToRad(spot.rot || 0), 0); }
      else { g.position.set(spot.at[0], floorUnder(spot.at[0], spot.at[2]), spot.at[2]); g.rotation.set(-0.18, THREE.MathUtils.degToRad(spot.rot || 0), 0); }
      slim(g); g.traverse((o) => { if (o.isMesh) o.castShadow = false; });
      litTree(g); inner.add(g); kept.set(k.job, { key: keyOf(k.job, k.tier), g });
    }
  }

  // ── EACH FRAME ──
  const lamps = [], lw = new THREE.Vector3(), fillNow = new THREE.Color();
  let clock = 0, nearOn = true;
  function update(dt, { night = 0 } = {}) {
    clock += dt;
    frame();
    // (the pieces inside drawn only near, and while the building's inside is to be seen: a door open, or inside)
    inner.visible = nearOn && B.loaded && B.seen;
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
    // the lamps' light: where each lamp is in the valley, and how bright now (its flicker), turned down by the valley's
    // night exposure (the lamps are tuned for the day's exposure of 1)
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
    if (on === nearOn) return; nearOn = on;
    if (!on) for (const v of U.lampCol.value) v.set(0, 0, 0);
  }

  // where the valley shows from inside: the windows' glass (its corners, a few points a pane) and each doorway's corners
  let holes = null;
  function openings() {
    if (holes) return holes;
    holes = [];
    for (const r of [B.group, ...B.insideRoots()]) r.traverse((m) => {
      if (!m.isMesh || (m.name !== 'pane' && m.name !== 'glass')) return;
      const P = m.geometry.attributes.position, step = Math.max(1, Math.floor(P.count / 120));
      for (let i = 0; i < P.count; i += step) holes.push([P.getX(i), P.getY(i), P.getZ(i)]);
    });
    for (const D of B.doorways) { const [cx, cy, cz] = D.centre, s = [D.out[2], -D.out[0]]; for (const [u, v] of [[0, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]]) holes.push([cx + s[0] * u * D.w / 2, cy + v * D.h / 2, cz + s[1] * u * D.w / 2]); }
    return holes;
  }

  // the openings as rectangles: each window's glass (its pane shapes' corners gathered by window: those within 1.2 m of
  // one another, flat across one way), and each doorway to the outside
  let rects = null;
  function portals() {
    if (rects) return rects;
    rects = [];
    const pts = [];
    for (const r of [B.group, ...B.insideRoots()]) r.traverse((m) => {
      if (!m.isMesh || (m.name !== 'pane' && m.name !== 'glass') || m.parent && m.parent.name === 'door') return;
      const P = m.geometry.attributes.position; for (let i = 0; i < P.count; i++) pts.push([P.getX(i), P.getY(i), P.getZ(i)]);
    });
    const groups = [];
    for (const p of pts) {
      let g = groups.find((q) => Math.abs(p[0] - q.mx) < 1.2 && Math.abs(p[1] - q.my) < 1.4 && Math.abs(p[2] - q.mz) < 1.2);
      if (!g) { g = { lo: p.slice(), hi: p.slice(), n: 0, sx: 0, sy: 0, sz: 0, mx: p[0], my: p[1], mz: p[2] }; groups.push(g); }
      for (let a = 0; a < 3; a++) { g.lo[a] = Math.min(g.lo[a], p[a]); g.hi[a] = Math.max(g.hi[a], p[a]); }
      g.n++; g.sx += p[0]; g.sy += p[1]; g.sz += p[2]; g.mx = g.sx / g.n; g.my = g.sy / g.n; g.mz = g.sz / g.n;
    }
    for (const g of groups) {
      const dx = g.hi[0] - g.lo[0], dy = g.hi[1] - g.lo[1], dz = g.hi[2] - g.lo[2];
      if (dy < 0.25 || Math.max(dx, dz) < 0.25 || Math.min(dx, dz) > 0.25) continue;   // (a lantern's glass, not a window)
      const c = [(g.lo[0] + g.hi[0]) / 2, (g.lo[1] + g.hi[1]) / 2, (g.lo[2] + g.hi[2]) / 2], acrossX = dx < dz;
      const n = acrossX ? [Math.sign(c[0]) || 1, 0, 0] : [0, 0, Math.sign(c[2]) || 1];
      const corners = acrossX ? [[c[0], g.lo[1], g.lo[2]], [c[0], g.lo[1], g.hi[2]], [c[0], g.hi[1], g.hi[2]], [c[0], g.hi[1], g.lo[2]]]
        : [[g.lo[0], g.lo[1], c[2]], [g.hi[0], g.lo[1], c[2]], [g.hi[0], g.hi[1], c[2]], [g.lo[0], g.hi[1], c[2]]];
      rects.push({ c, corners, n });
    }
    for (const D of (B.B.anchors.doorways || []).filter((q) => !q.inner)) {   // (the doors to the outside: a window beyond an inside door is its own portal)
      const [cx, cy, cz] = D.centre, s = [D.out[2], -D.out[0]], hw = D.w / 2, hh = D.h / 2;
      rects.push({ c: [cx, cy, cz], n: [D.out[0], 0, D.out[2]], corners: [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [cx + s[0] * u * hw, cy + v * hh, cz + s[1] * u * hw]) });
    }
    return rects;
  }

  function dispose() {
    const i = CODE.blockers.indexOf(blocker); if (i >= 0) CODE.blockers.splice(i, 1);
    if (ghostObj) ghostObj.removeFromParent();
    for (const m of ghostMats.values()) m.dispose(); ghostMats.clear();
    for (const k of kept.values()) disposeTree(k.g); kept.clear();
    Promise.all([...pieces.values()]).then((gs) => {
      for (const g of gs) { const mine = []; g.traverse((q) => { if (q.userData.made) mine.push(q); }); for (const m of mine) disposeTree(m); g.removeFromParent(); }
    }).catch(() => {});
    Promise.all([...files.values()]).then((ts) => { for (const t of ts) disposeTree(t); }).catch(() => {});
    pieces.clear(); files.clear(); shown.clear(); boxes.clear();
    group.removeFromParent();
    disposeShared();
  }

  return {
    group, inner, code: B, layout: Lay, lit, floorUnder, pushOut, inside, furnish, ghost, pop, keepsakes, update, dispose, toWorld, toLocal,
    near: setNear, get yaw() { return yawOf(); }, uniforms: U, spec: (id) => SPEC[id],
    keepLook: (job) => { const k = KEEP[job]; if (!k) return null; return [k.at[0] - (k.wall ? k.wall[0] * 0.15 : 0), k.at[1] == null ? floorUnder(k.at[0], k.at[2]) + (k.table ? 0.95 : 0.35) : k.at[1], k.at[2] - (k.wall ? k.wall[2] * 0.15 : 0)]; },
    bedSpots: (n) => BED_SPOTS.slice(0, Math.max(1, n)).map((q) => ({ ...q, y: floorUnder(q.x, q.z) })),
    stale: () => !o.code || o.code !== B || !B.group.parent,
    openings, portals,
    get owned() { return owned.slice(); }, get shown() { return [...shown.keys()]; }, get nearOn() { return nearOn; }, boxes,
  };
}
