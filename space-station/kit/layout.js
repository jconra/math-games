// ROOMS AS DATA, and building them. A room is plain JSON:
//   { "name": "...", "pieces": [ { "piece": "wall", "cell": [-0.5, 2], "turn": 1, "variant": "locker" }, ... ],
//     "views": { "start": { "at": [x, y, z], "look": [x, y, z], "fov": 60 } }, "probe": [x, y, z] }
// (piece, cell, turn, variant; optional off [x, y, z] in metres and deck). buildRoom turns it into a few meshes:
// every static piece is merged into ONE mesh per material, the strips' light and the corner darkening are baked in,
// and the door leaves are instanced (one draw per material for all the leaves) so they can slide.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PIECES } from './catalog.js';
import { placeMatrix, onGrid, WALL_FACE } from './grid.js';
import { Piece } from './piece.js';
import { bake, lightAt } from './bake.js';
import { MAT_KEYS, BAKED } from './materials.js';

const CACHE = new Map();
// a piece drawn once in its own frame, kept for every copy
export function builtPiece(id, variant) {
  const def = PIECES[id]; if (!def) throw new Error('kit: no piece called ' + id);
  const v = variant ?? def.variants[0], key = id + ':' + v;
  let p = CACHE.get(key);
  if (!p) { if (def.prefab) throw new Error('kit: ' + id + ' is made of other pieces; expand it'); p = new Piece(); def.build(p, v); CACHE.set(key, p); }
  return p;
}

// a placement turned by a parent's quarter turns (the same turn as placeMatrix)
function turnCell([x, z], t) { for (let i = 0; i < ((t % 4) + 4) % 4; i++) [x, z] = [z, -x]; return [x, z]; }
// prefabs (pieces made of pieces) opened out into plain pieces; anything unknown is reported, not built
export function expand(pieces, problems = []) {
  const out = [];
  const rec = (pl, parent) => {
    const def = PIECES[pl.piece]; if (!def) { problems.push('no piece called ' + pl.piece); return; }
    const variant = pl.variant ?? def.variants[0];
    if (!def.variants.includes(variant)) problems.push(`${pl.piece} has no variant ${variant}`);
    let placed = { ...pl, variant };
    if (parent) { const [rx, rz] = turnCell(pl.cell || [0, 0], parent.turn || 0); placed = { ...placed, cell: [parent.cell[0] + rx, parent.cell[1] + rz], turn: ((pl.turn || 0) + (parent.turn || 0)) % 4, deck: parent.deck }; }
    if (!onGrid(placed)) problems.push(`${pl.piece} at ${JSON.stringify(pl.cell)} is off the grid`);
    if (def.prefab) { for (const c of def.prefab(variant)) rec(c, placed); return; }
    out.push(placed);
  };
  for (const pl of pieces) rec(pl, null);
  return out;
}

// the solid material's wear texture is mapped from the world, each face by the axis it faces most, so smudges run
// on across neighbouring panels and every copy of a panel gets its own
function worldUV(g) {
  const p = g.attributes.position.array, n = g.attributes.normal.array, uv = g.attributes.uv.array;
  for (let i = 0; i < p.length / 3; i++) {
    const ax = Math.abs(n[i * 3]), ay = Math.abs(n[i * 3 + 1]), az = Math.abs(n[i * 3 + 2]);
    if (ax >= ay && ax >= az) { uv[i * 2] = p[i * 3 + 2]; uv[i * 2 + 1] = p[i * 3 + 1]; }
    else if (ay >= az) { uv[i * 2] = p[i * 3]; uv[i * 2 + 1] = p[i * 3 + 2]; }
    else { uv[i * 2] = p[i * 3]; uv[i * 2 + 1] = p[i * 3 + 1]; }
  }
  g.attributes.uv.needsUpdate = true;
}

const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _d = new THREE.Vector3(), _t = new THREE.Matrix4();
// opts.bake: { voxel, rays, reach, shadows } (see bake.js); opts.extra: more geometries per material (a stage)
export function buildRoom(room, mats, opts = {}) {
  const t0 = performance.now(), problems = [], list = expand(room.pieces || [], problems);
  const lists = Object.fromEntries(MAT_KEYS.map((k) => [k, []])), lights = [], doors = [], leafGroups = new Map();
  for (const pl of list) {
    const def = PIECES[pl.piece], p = builtPiece(pl.piece, pl.variant), off = [...(pl.off || [0, 0, 0])];
    if (def.at === 'wall') off[2] += WALL_FACE;
    placeMatrix({ ...pl, off }, _m);
    for (const part of p.parts) lists[part.mat].push(part.geo.clone().applyMatrix4(_m));
    for (const L of p.lights) lights.push({ ...L, at: _v.set(...L.at).applyMatrix4(_m).toArray(), dir: L.dir ? _d.set(...L.dir).transformDirection(_m).toArray() : null });
    const mine = new Map();
    for (const dr of p.doors) { const D = { piece: pl.piece, at: pl.cell, sense: new THREE.Vector3(...dr.sense).applyMatrix4(_m), near: dr.near, speed: dr.speed, t: 0, target: 0, leaves: [] }; doors.push(D); mine.set(dr.id, D); }
    for (const mv of p.movers) {
      if (!leafGroups.has(mv.key)) leafGroups.set(mv.key, { piece: mv.piece, list: [] });
      const leaf = { M: _m.clone(), base: mv.base, slide: mv.slide, door: mine.get(mv.door) };
      leafGroups.get(mv.key).list.push(leaf); if (leaf.door) leaf.door.leaves.push(leaf);
    }
  }
  for (const [k, gs] of Object.entries(opts.extra || {})) lists[k].push(...gs);
  const merged = {};
  for (const k of MAT_KEYS) if (lists[k].length) { merged[k] = mergeGeometries(lists[k], false); for (const g of lists[k]) g.dispose(); }
  if (merged.solid) worldUV(merged.solid);
  const tMerge = performance.now();
  const receivers = [...BAKED].filter((k) => merged[k]).map((k) => merged[k]);
  const occluders = ['solid', 'floor'].filter((k) => merged[k]).map((k) => merged[k]);
  const B = bake(receivers, occluders, lights, opts.bake || {});
  const group = new THREE.Group(); group.name = room.name || 'room';
  const stats = { pieces: list.length, draws: 0, tris: 0, perMat: {}, lights: lights.length, doors: doors.length, leaves: 0, bake: { ms: Math.round(B.ms), verts: B.verts, voxels: B.voxels, voxel: B.voxelSize }, problems };
  for (const k of MAT_KEYS) {
    const g = merged[k]; if (!g) continue;
    const m = new THREE.Mesh(g, mats[k]); m.name = k; m.castShadow = k !== 'glass' && k !== 'glow'; m.receiveShadow = k !== 'glow'; m.matrixAutoUpdate = false;
    if (k === 'glass') m.renderOrder = 2;
    group.add(m); const tris = g.index.count / 3; stats.draws++; stats.tris += tris; stats.perMat[k] = Math.round(tris);
  }
  // the door leaves: one instanced mesh per material per kind of leaf
  for (const [key, G] of leafGroups) {
    const lp = G.piece, byMat = {};
    for (const part of lp.parts) (byMat[part.mat] ||= []).push(part.geo.clone());
    const geos = {}; for (const [k, gs] of Object.entries(byMat)) geos[k] = mergeGeometries(gs, false);
    const self = Object.entries(geos).filter(([k]) => BAKED.has(k)).map(([, g]) => g);
    bake(self, self, [], { voxel: 0.02, reach: 0.25, strength: 0.6 });
    const meshes = [];
    for (const [k, g] of Object.entries(geos)) {
      const im = new THREE.InstancedMesh(g, mats[k + 'Inst'] || mats[k], G.list.length); im.name = key + ':' + k; im.frustumCulled = false; im.castShadow = k !== 'glass'; im.receiveShadow = true;
      if (BAKED.has(k)) {
        const ib = new Float32Array(G.list.length * 3);
        G.list.forEach((leaf, i) => { const c = new THREE.Vector3(0, 1.2, 0).applyMatrix4(leaf.M); const [r, gg, b] = lightAt(c, lights); ib.set([r, gg, b], i * 3); });
        g.setAttribute('iBake', new THREE.InstancedBufferAttribute(ib, 3));
      }
      meshes.push(im); group.add(im); stats.draws++; stats.tris += g.index.count / 3 * G.list.length;
    }
    G.list.forEach((leaf, i) => { leaf.meshes = meshes; leaf.index = i; setLeaf(leaf, 0); });
    stats.leaves += G.list.length;
  }
  stats.tris = Math.round(stats.tris); stats.ms = Math.round(performance.now() - t0); stats.mergeMs = Math.round(tMerge - t0);
  return { group, doors, lights, stats, voxels: B.V, dispose() { group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); } };
}

const ease = (t) => t * t * (3 - 2 * t);
function setLeaf(leaf, t) {
  _t.makeTranslation(leaf.slide.x * ease(t), leaf.slide.y * ease(t), leaf.slide.z * ease(t));
  _m.copy(leaf.M).multiply(_t).multiply(leaf.base);
  for (const im of leaf.meshes) { im.setMatrixAt(leaf.index, _m); im.instanceMatrix.needsUpdate = true; }
}
// doors open by themselves as someone comes near (mode 'auto'), or stay 'open' or 'shut'; returns whether any moved
export function updateDoors(doors, eye, dt, mode = 'auto') {
  let moved = false;
  for (const D of doors) {
    const dx = eye.x - D.sense.x, dz = eye.z - D.sense.z, dy = Math.max(0, Math.abs(eye.y - D.sense.y) - 1.4);
    D.target = mode === 'open' ? 1 : mode === 'shut' ? 0 : (Math.hypot(dx, dz, dy) < D.near ? 1 : 0);
    if (D.t === D.target) continue;
    D.t = D.t < D.target ? Math.min(D.target, D.t + dt * D.speed) : Math.max(D.target, D.t - dt * D.speed * 0.8);
    for (const leaf of D.leaves) setLeaf(leaf, D.t);
    moved = true;
  }
  return moved;
}
export function setDoors(doors, t) { for (const D of doors) { D.t = D.target = t; for (const leaf of D.leaves) setLeaf(leaf, t); } }

// the box a room's pieces fill (their own parts and door leaves, as placed)
export function roomBounds(room) {
  const box = new THREE.Box3(), b = new THREE.Box3();
  for (const pl of expand(room.pieces || [])) {
    const def = PIECES[pl.piece], p = builtPiece(pl.piece, pl.variant), off = [...(pl.off || [0, 0, 0])];
    if (def.at === 'wall') off[2] += WALL_FACE;
    placeMatrix({ ...pl, off }, _m);
    for (const part of p.parts) { part.geo.computeBoundingBox(); box.union(b.copy(part.geo.boundingBox).applyMatrix4(_m)); }
    for (const mv of p.movers) for (const part of mv.piece.parts) { part.geo.computeBoundingBox(); box.union(b.copy(part.geo.boundingBox).applyMatrix4(mv.base).applyMatrix4(_m)); }
  }
  return box;
}

// a room file, fetched (the game will load its rooms the same way)
export async function loadRoom(url) { const r = await fetch(url); if (!r.ok) throw new Error('kit: no room at ' + url); return r.json(); }
