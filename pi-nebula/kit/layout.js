// ROOMS AS DATA, and building them. A room is plain JSON:
//   { "name": "...", "pieces": [ { "piece": "wall", "cell": [-0.5, 2], "turn": 1, "variant": "locker" }, ... ],
//     "views": { "start": { "at": [x, y, z], "look": [x, y, z], "fov": 60 } }, "probe": [x, y, z] }
// (piece, cell, turn, variant; optional off [x, y, z] in metres and deck). buildRoom turns it into a few meshes:
// every static piece is merged into ONE mesh per material, the strips' light and the corner darkening are baked in,
// and the door leaves are instanced (one draw per material for all the leaves) so they can slide. (A leaf marked
// `still`, a door flush in a ship's skin, is lit and painted with the room's still parts and drawn as its own mesh.)
// A part that glides by itself (a piece's p.glide: a scanner's ring along its rails) is a door nobody opens: its
// leaves are moved by updateGlides from the kit's clock, and only while its room is drawn.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { PIECES } from './catalog.js';
import { placeMatrix, onGrid, WALL_FACE } from './grid.js';
import { Piece } from './piece.js';
import { aimMatrix } from './leafaim.js';
import { bake, bakeWith, makeVoxels, lightBins, lightAt } from './bake.js';
import { applyBake } from './bakefile.js';
import { MAT_KEYS, BAKED, GLOWING, U, hoopLit } from './materials.js';

const CACHE = new Map();
// a piece drawn once in its own frame, kept for every copy
export function builtPiece(id, variant, coarse = false) {
  const def = PIECES[id]; if (!def) throw new Error('kit: no piece called ' + id);
  const v = variant ?? def.variants[0], key = id + ':' + v + (coarse ? ':coarse' : '');
  let p = CACHE.get(key);
  if (!p) {
    if (def.prefab) throw new Error('kit: ' + id + ' is made of other pieces; expand it');
    Piece.coarse = !!coarse; try { p = new Piece(); def.build(p, v); } finally { Piece.coarse = false; }
    CACHE.set(key, p);
  }
  return p;
}

// forget a piece drawn once and kept (a piece made for one build only: the Ship Lab's cabin, built from a blueprint
// that is edited)
export function forgetPiece(id) { for (const k of [...CACHE.keys()]) if (k.startsWith(id + ':')) CACHE.delete(k); }

// a placement turned by a parent's quarter turns (the same turn as placeMatrix)
function turnCell([x, z], t) { for (let i = 0; i < ((t % 4) + 4) % 4; i++) [x, z] = [z, -x]; return [x, z]; }
// prefabs (pieces made of pieces) opened out into plain pieces; anything unknown is reported, not built
export function expand(pieces, problems = []) {
  const out = [];
  const rec = (pl, parent) => {
    const def = PIECES[pl.piece]; if (!def) { problems.push('no piece called ' + pl.piece); return; }
    const variant = pl.variant ?? def.variants[0];
    if (!def.variants.includes(variant) && !def.accepts?.(variant)) problems.push(`${pl.piece} has no variant ${variant}`);
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

const _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _d = new THREE.Vector3(), _t = new THREE.Matrix4(), IDENT = new THREE.Matrix4().elements;
// an attribute stored as normalized integers (the shader still reads it as floats from -1 or 0 to 1)
// (in four parts, not three: a GPU reading three 16-bit or 8-bit numbers may convert them on every draw, measured at
// 25 times slower here; four-part ones it reads as they are. The fourth is padding: 0, or full for a colour's alpha.)
export function compact(g, name, Type, max) {
  const a = g.attributes[name]; if (!a || !(a.array instanceof Float32Array) || a.itemSize !== 3) return;
  const src = a.array, n = src.length / 3, dst = new Type(n * 4), lo = Type === Uint8Array ? 0 : -1, pad = name === 'color' ? max : 0;
  for (let i = 0; i < n; i++) { for (let k = 0; k < 3; k++) dst[i * 4 + k] = Math.round(Math.max(lo, Math.min(1, src[i * 3 + k])) * max); dst[i * 4 + 3] = pad; }
  g.setAttribute(name, new THREE.BufferAttribute(dst, 4, true));
}
// a piece's parts merged once per material: every copy of it is written from these
function pieceByMat(p) {
  if (!p.byMat) {
    const by = {}; for (const part of p.parts) (by[part.mat] ||= []).push(part.geo);
    p.byMat = Object.fromEntries(Object.entries(by).map(([k, gs]) => [k, gs.length === 1 ? gs[0] : mergeGeometries(gs, false)]));
  }
  return p.byMat;
}
// copies of geometries, each placed by its matrix's elements (a turn about the up axis and a shift: the normals turn
// with it), written straight into one geometry (no copy made per placement)
function mergePlaced(items) {
  const g0 = items[0].geo, names = Object.keys(g0.attributes);
  let nv = 0, ni = 0; for (const it of items) { nv += it.geo.attributes.position.count; ni += it.geo.index.count; }
  const arrs = Object.fromEntries(names.map((n) => [n, new Float32Array(nv * g0.attributes[n].itemSize)])), idx = new Uint32Array(ni);
  let vo = 0, io = 0;
  for (const { geo, e } of items) {
    const cnt = geo.attributes.position.count;
    for (const n of names) {
      const a = geo.attributes[n]; if (!a) throw new Error('kit: parts of one material must share their attributes (' + n + ')');
      const src = a.array, dst = arrs[n], sz = a.itemSize, o = vo * sz;
      if (n === 'position') for (let i = 0; i < cnt; i++) { const x = src[i * 3], y = src[i * 3 + 1], z = src[i * 3 + 2], j = o + i * 3; dst[j] = e[0] * x + e[4] * y + e[8] * z + e[12]; dst[j + 1] = e[1] * x + e[5] * y + e[9] * z + e[13]; dst[j + 2] = e[2] * x + e[6] * y + e[10] * z + e[14]; }
      else if (n === 'normal') for (let i = 0; i < cnt; i++) { const x = src[i * 3], y = src[i * 3 + 1], z = src[i * 3 + 2], j = o + i * 3; dst[j] = e[0] * x + e[4] * y + e[8] * z; dst[j + 1] = e[1] * x + e[5] * y + e[9] * z; dst[j + 2] = e[2] * x + e[6] * y + e[10] * z; }
      else dst.set(src, o);
    }
    const si = geo.index.array; for (let k = 0; k < si.length; k++) idx[io + k] = si[k] + vo;
    vo += cnt; io += si.length;
  }
  const g = new THREE.BufferGeometry();
  for (const n of names) g.setAttribute(n, new THREE.BufferAttribute(arrs[n], g0.attributes[n].itemSize));
  g.setIndex(new THREE.BufferAttribute(idx, 1)); return g;
}
// A room file holds either one room ("pieces": [...]) or a whole station of rooms ("rooms": [{ "id", "name",
// "probe", "pieces" }, ...]). Each room (a zone) is merged into its own meshes, one per material, so it can be baked
// on its own, culled on its own and lit by its own picture of itself.
//   opts.bake: { voxel, rays, reach, shadows } (see bake.js); opts.extra: more geometries per material (a stage);
//   opts.saved: a saved bake (bakefile.js): zones whose geometry still matches take their light from it;
//   opts.zoneMats(id): the material set for a zone (default: mats for all)
export function zonesOf(room) { return room.rooms ? room.rooms : [{ id: room.id || 'room', name: room.name, probe: room.probe, sky: room.sky, coarse: room.coarse, pieces: room.pieces || [] }]; }
// the grid a zone's pieces are placed on: its own, its room's, or (none given) the station's
const gridOf = (zd, room) => zd.grid || room.grid || null;
// THE ROOMS BUILT A PIECE AT A TIME (2026-11-26, THE MAKER WHILE THE GAME LOADS): buildRoom's work as steps (a step a
// piece, a zone, a door leaf); buildRoom takes them all at once, as ever; buildRoomSoon takes some 12 ms' worth at a
// time and gives the page its turn between (turn(): a promise), so the title can be used while the station is built
export function buildRoom(room, mats, opts = {}) {
  const it = roomSteps(room, mats, opts); let r;
  while (!(r = it.next()).done);
  return r.value;
}
export async function buildRoomSoon(room, mats, opts = {}, turn = () => new Promise((go) => setTimeout(go, 0))) {
  const it = roomSteps(room, mats, opts); let r, t0 = performance.now();
  while (!(r = it.next()).done) if (performance.now() - t0 > 12) { await turn(); t0 = performance.now(); }
  return r.value;
}
function* roomSteps(room, mats, opts) {
  const t0 = performance.now(), problems = [], lights = [], doors = [], glides = [], leafGroups = new Map(), zones = [];
  let pieceCount = 0;
  for (const zd of zonesOf(room)) {
    yield;
    const list = expand(zd.pieces || [], problems), lists = Object.fromEntries(MAT_KEYS.map((k) => [k, []])), stills = {};
    pieceCount += list.length;
    for (const pl of list) {
      yield;
      const def = PIECES[pl.piece], p = builtPiece(pl.piece, pl.variant, zd.coarse), off = [...(pl.off || [0, 0, 0])];
      if (def.at === 'wall') off[2] += WALL_FACE;
      // (a piece whose catalog entry has a `raise` stands that much higher than it is placed: the Miner on its longer legs)
      if (def.raise) off[1] += def.raise;
      placeMatrix({ ...pl, off }, _m, gridOf(zd, room));
      const e = _m.elements.slice(); for (const [k, g] of Object.entries(pieceByMat(p))) lists[k].push({ geo: g, e });
      for (const L of p.lights) lights.push({ ...L, at: _v.set(...L.at).applyMatrix4(_m).toArray(), dir: L.dir ? _d.set(...L.dir).transformDirection(_m).toArray() : null });
      const mine = new Map();
      // (a placement's `hold`: its doors stay at that much open whatever comes near, whatever the mode: a parked ship's
      // folded arms and lowered legs)
      // (a part that glides by itself is kept apart from the doors: nothing that works the doors ever sees it)
      for (const dr of p.doors) { const h = pl.hold ?? null, D = { piece: pl.piece, variant: pl.variant, at: pl.cell, zone: zd.id, sense: new THREE.Vector3(...dr.sense).applyMatrix4(_m), near: dr.near, speed: dr.speed, heavy: !!dr.heavy, t: h ?? 0, target: h ?? 0, hold: h, leaves: [] }; if (dr.glide) { D.glide = dr.glide; glides.push(D); } else doors.push(D); mine.set(dr.id, D); }
      for (const mv of p.movers) {
        // (a leaf whose door is held never moves: it is posed once and goes into the room's own still geometry, so it
        // is drawn with its room and costs no batch of its own: a parked ship's folded arms, its legs)
        const held = mine.get(mv.door);
        if (held && held.hold != null) {
          const e2 = leafMatrix({ M: _m, base: mv.base, slide: mv.slide, hinge: mv.hinge, aim: mv.aim }, held.hold, _lm).elements.slice();
          for (const [k, g] of Object.entries(pieceByMat(mv.piece))) lists[k].push({ geo: g, e: e2 });
          continue;
        }
        // (a STILL leaf, a door whose outside is part of a ship's skin: lit with its room as it stands shut, vertex by
        // vertex, and painted with the room's own materials, so shut it cannot be told from the still parts round
        // it. Its triangles go in with the room's still ones, last (they are lit and saved with them), and are drawn
        // as a mesh of their own, which moves: stillMeshes, below. It takes no part in what a person can walk on.)
        if (mv.still) {
          const leaf = { key: mv.key, piece: mv.piece, M: _m.clone(), base: mv.base, slide: mv.slide, door: held || null, meshes: [], own: [] };
          if (mv.hinge) leaf.hinge = mv.hinge;
          if (mv.aim) leaf.aim = mv.aim;
          if (mv.hoop) leaf.hoop = mv.hoop;
          const e0 = leafMatrix(leaf, 0, _lm).elements.slice();
          leaf.shut = new THREE.Matrix4().fromArray(e0).invert();
          for (const [k, g] of Object.entries(pieceByMat(mv.piece))) (stills[k] ||= []).push({ geo: g, e: e0, leaf });
          if (leaf.door) leaf.door.leaves.push(leaf);
          continue;
        }
        if (!leafGroups.has(mv.key)) leafGroups.set(mv.key, { piece: mv.piece, list: [] });
        const leaf = { piece: mv.piece, M: _m.clone(), base: mv.base, slide: mv.slide, door: mine.get(mv.door) };
        if (mv.hinge) leaf.hinge = mv.hinge;
        if (mv.aim) leaf.aim = mv.aim;
        if (mv.hoop) leaf.hoop = mv.hoop;
        leafGroups.get(mv.key).list.push(leaf); if (leaf.door) leaf.door.leaves.push(leaf);
      }
    }
    if (!zones.length) for (const [k, gs] of Object.entries(opts.extra || {})) lists[k].push(...gs.map((geo) => ({ geo, e: IDENT })));
    const merged = {};
    for (const k of MAT_KEYS) {
      const S = stills[k] || []; if (!lists[k].length && !S.length) continue;
      const g = merged[k] = mergePlaced([...lists[k], ...S]);
      // (the still leaves' triangles taken back out of what is drawn, and walked on, as the room: each leaf keeps its own)
      if (S.length) { const all = g.index.array; let n = 0; for (const it of lists[k]) n += it.geo.index.count; g.setIndex(new THREE.BufferAttribute(all.slice(0, n), 1)); for (const it of S) { const c = it.geo.index.count; it.index = all.slice(n, n + c); n += c; } }
    }
    if (merged.solid) worldUV(merged.solid);
    zones.push({ id: zd.id, name: zd.name || zd.id, probe: zd.probe, sky: zd.sky, with: zd.with, merged, stills, pieces: list.length });
  }
  const tMerge = performance.now();
  // the light: from the saved bake where it still matches, worked out here for the rest (against one shared grid of
  // voxels, so a room's corners and shadows see its neighbours' walls through a doorway)
  let V = null, bins = null, bakeMs = 0, saved = 0, live = 0, verts = 0;
  for (const z of zones) {
    yield;
    const todo = [];
    for (const k of BAKED) if (z.merged[k]) { if (opts.saved && applyBake(opts.saved, z.id, k, z.merged[k], THREE)) saved++; else todo.push(z.merged[k]); verts += z.merged[k].attributes.position.count; }
    z.bakedFrom = todo.length ? 'live' : 'saved';
    if (!todo.length) continue;
    if (!V) {
      const tv = performance.now(), occ = zones.flatMap((q) => ['solid', 'floor'].filter((k) => q.merged[k]).map((k) => q.merged[k]));
      V = makeVoxels(occ, opts.bake?.voxel ?? 0.07); bins = lightBins(lights, V); bakeMs += performance.now() - tv;
    }
    const r = bakeWith(todo, V, bins, { ...(opts.bake || {}), sky: z.sky }); bakeMs += r.ms; live += todo.length;
  }
  // smaller numbers for what does not need floats, once the light is in: normals as 16-bit, the painted parts' colour
  // and roughness / metalness / wear as bytes (a vertex shrinks from about 84 bytes to 52: less to send to the GPU)
  if (opts.compact !== false) for (const z of zones) for (const k of ['solid', 'floor']) { yield; const g = z.merged[k]; if (!g) continue; compact(g, 'normal', Int16Array, 32767); if (k === 'solid') { compact(g, 'color', Uint8Array, 255); compact(g, 'aRMW', Uint8Array, 255); } }
  const group = new THREE.Group(); group.name = room.name || 'room';
  const stats = { pieces: pieceCount, draws: 0, tris: 0, perMat: {}, perZone: {}, zones: zones.length, lights: lights.length, doors: doors.length, glides: glides.length, leaves: 0,
    bake: { ms: Math.round(bakeMs), verts, saved, live, voxels: V?.count || 0, bricks: V?.bricks || 0, voxelMB: V ? +(V.bytes / 1048576).toFixed(1) : 0, voxel: V?.s || 0 }, problems };
  for (const z of zones) {
    const zg = new THREE.Group(); zg.name = 'zone:' + z.id; group.add(zg); z.group = zg; z.box = new THREE.Box3(); z.tris = 0;
    const zm = opts.zoneMats?.(z.with?.[0] || z.id) || mats; z.mats = zm;   // (a door's zone shares its first room's materials)
    for (const k of MAT_KEYS) {
      const g = z.merged[k]; if (!g) continue;
      const m = new THREE.Mesh(g, zm[k]); m.name = k; m.castShadow = k !== 'glass' && !GLOWING.has(k) && k !== 'shield'; m.receiveShadow = !GLOWING.has(k); m.matrixAutoUpdate = false;
      if (k === 'glass') m.renderOrder = 2; if (k === 'shield') m.renderOrder = 3;
      g.computeBoundingBox(); g.computeBoundingSphere(); z.box.union(g.boundingBox);
      zg.add(m); const tris = g.index.count / 3; stats.draws++; stats.tris += tris; z.tris += tris; stats.perMat[k] = Math.round((stats.perMat[k] || 0) + tris);
      // (stillMeshes: each still leaf's own mesh, of the room's own vertices and material; setLeaf moves it)
      for (const it of z.stills[k] || []) {
        const sg = new THREE.BufferGeometry(); for (const [name, a] of Object.entries(g.attributes)) sg.setAttribute(name, a);
        sg.setIndex(new THREE.BufferAttribute(it.index, 1));
        const sm = new THREE.Mesh(sg, zm[k]); sm.name = it.leaf.key + ':' + k; sm.castShadow = m.castShadow; sm.receiveShadow = m.receiveShadow; sm.renderOrder = m.renderOrder; sm.matrixAutoUpdate = false; sm.frustumCulled = false;
        zg.add(sm); it.leaf.own.push(sm); if (!it.leaf.counted) { it.leaf.counted = true; stats.leaves++; }
        const st = it.index.length / 3; stats.draws++; stats.tris += st; z.tris += st; stats.perMat[k] = Math.round((stats.perMat[k] || 0) + st);
      }
    }
    stats.perZone[z.id] = Math.round(z.tris);
  }
  // the door leaves: one instanced mesh per material per kind of leaf
  for (const [key, G] of leafGroups) {
    yield;
    const lp = G.piece, byMat = {};
    for (const part of lp.parts) (byMat[part.mat] ||= []).push(part.geo.clone());
    const geos = {}; for (const [k, gs] of Object.entries(byMat)) geos[k] = mergeGeometries(gs, false);
    const self = Object.entries(geos).filter(([k]) => BAKED.has(k)).map(([, g]) => g);
    if (self.length) bake(self, self, [], { voxel: 0.02, reach: 0.25, strength: 0.6 });   // (a leaf may be only light: a lamp, a display's strokes)
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
    G.list.forEach((leaf, i) => { leaf.meshes = meshes; leaf.index = i; setLeaf(leaf, leaf.door?.hold ?? 0); });
    stats.leaves += G.list.length;
  }
  // the parts that glide by themselves: each one's room (it moves only while that room is drawn), and the box its
  // leaves pass through from rest to fully out (where nobody may stand: the game's walls)
  for (const D of glides) {
    D.room = zones.find((z) => z.id === D.zone) || null; D.sweep = new THREE.Box3();
    for (const leaf of D.leaves) for (const part of leaf.piece.parts) {
      if (!part.geo.boundingBox) part.geo.computeBoundingBox();
      for (const t of [0, 1]) D.sweep.union(_gb.copy(part.geo.boundingBox).applyMatrix4(leafMatrix(leaf, t, _lm)));
    }
    // (the hoop of light one of its leaves carries, if any: dark until hoopLights switches it on)
    const hl = D.leaves.find((l) => l.hoop); D.hoop = hl ? { leaf: hl, ...hl.hoop } : null; D.lit = false;
  }
  stats.tris = Math.round(stats.tris); stats.ms = Math.round(performance.now() - t0); stats.mergeMs = Math.round(tMerge - t0);
  return { group, doors, glides, lights, stats, zones, get voxels() { return V; }, dispose() { group.traverse((o) => { if (o.geometry) o.geometry.dispose(); }); } };
}

// Which of a station's rooms are drawn. (A door between two rooms is a little zone of its own, "with" both: it is
// drawn when either is, so a shut door always shows its frame from whichever side the eye is on.) With a camera and the room file's portals (the openings between rooms, each a
// box [[x0, y0, z0], [x1, y1, z1]] joining rooms a and b): the room the eye is in, and any room reached through
// portals that are on screen (up to four rooms away). Without: every room within `range` metres of the eye (for the
// light probes, which look all round). three.js also leaves out each mesh that is off screen.
const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _pb = new THREE.Box3();
export function updateZones(built, eye, range = 34, cam = null, portals = null) {
  if (!built?.zones || built.zones.length < 2) return;
  if (cam && portals?.length) {
    cam.updateMatrixWorld(); _pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); _fr.setFromProjectionMatrix(_pm);
    const start = zoneAt(built, eye), seen = new Set([start.id]), queue = [[start.id, 0]];
    while (queue.length) {
      const [id, d] = queue.shift(); if (d >= 4) continue;
      for (const P of portals) {
        const other = P.a === id ? P.b : P.b === id ? P.a : null; if (!other || seen.has(other)) continue;
        _pb.min.fromArray(P.box[0]); _pb.max.fromArray(P.box[1]);
        if (P.door && doorShut(built, P.door)) continue;   // (a shut door in the opening: nothing seen past it)
        if (_pb.distanceToPoint(eye) < 0.8 || _fr.intersectsBox(_pb)) { seen.add(other); queue.push([other, d + 1]); }
      }
    }
    for (const z of built.zones) z.group.visible = z.with ? z.with.some((w) => seen.has(w)) : seen.has(z.id);
    return;
  }
  for (const z of built.zones) z.group.visible = z.box.distanceToPoint(eye) < range;
}
// is the door nearest a point [x, z] (metres, within a metre) shut?
function doorShut(built, [x, z]) {
  let best = null, bd = 1;
  for (const D of built.doors) { const d = Math.hypot(D.sense.x - x, D.sense.z - z); if (d < bd) { bd = d; best = D; } }
  return !!best && best.t < 0.01;
}
// the zone the eye is in (or nearest to)
export function zoneAt(built, eye) {
  let best = null, bd = Infinity;
  for (const z of built?.zones || []) { if (z.with) continue; const d = z.box.distanceToPoint(eye); if (d < bd) { bd = d; best = z; } }
  return best;
}

const ease = (t) => t * t * (3 - 2 * t);
const _h = new THREE.Matrix4(), _hp = new THREE.Vector3(), _ha = new THREE.Vector3(), _lt = new THREE.Matrix4(), _lm = new THREE.Matrix4();
// where a leaf stands when its door is open by t (0..1), into `out`
function leafMatrix(leaf, t, out) {
  _lt.makeTranslation(leaf.slide.x * ease(t), leaf.slide.y * ease(t), leaf.slide.z * ease(t));
  out.copy(leaf.M).multiply(_lt);
  // (a leaf that swings: each hinge in turn, outermost first, turns it by its angle about its axis through its point;
  // a ramp's fold is a hinge on the ramp, given where it is when shut. Sliding leaves have none.)
  if (leaf.hinge) for (const H of leaf.hinge) {
    _hp.fromArray(H.at); _ha.fromArray(H.axis);
    out.multiply(_h.makeTranslation(_hp.x, _hp.y, _hp.z)).multiply(_h.makeRotationAxis(_ha, H.angle * ease(t))).multiply(_h.makeTranslation(-_hp.x, -_hp.y, -_hp.z));
  }
  // (a leaf that rides a line: kit/leafaim.js, by the eased t)
  if (leaf.aim) out.multiply(_h.fromArray(aimMatrix(leaf.aim, ease(t))));
  return out.multiply(leaf.base);
}
// (where a leaf stands when its door is open by t, for code outside the kit that must know: the crane, of the legs)
export const leafAt = (leaf, t, out = new THREE.Matrix4()) => leafMatrix(leaf, t, out);
function setLeaf(leaf, t) {
  // (a heavy door's t is its time on the way: it starts slowly and lands slowly, as a stair that weighs what a ship's
  // door weighs must)
  leafMatrix(leaf, leaf.door?.heavy ? t * t * (3 - 2 * t) : t, _m);
  // (a still leaf's meshes are where it stands shut already: moved from there)
  if (leaf.own) { _m.multiply(leaf.shut); for (const m of leaf.own) { m.matrix.copy(_m); m.matrixWorldNeedsUpdate = true; } return; }
  for (const im of leaf.meshes) { im.setMatrixAt(leaf.index, _m); im.instanceMatrix.needsUpdate = true; }
}
// doors open by themselves as someone comes near (mode 'auto'), or stay 'open' or 'shut'; returns whether any moved
export function updateDoors(doors, eye, dt, mode = 'auto') {
  let moved = false;
  for (const D of doors) {
    const dx = eye.x - D.sense.x, dz = eye.z - D.sense.z, dy = Math.max(0, Math.abs(eye.y - D.sense.y) - 1.4);
    D.target = D.hold != null ? D.hold : mode === 'open' ? 1 : mode === 'shut' ? 0 : (Math.hypot(dx, dz, dy) < D.near ? 1 : 0);
    if (D.t === D.target) continue;
    D.t = D.t < D.target ? Math.min(D.target, D.t + dt * D.speed) : Math.max(D.target, D.t - dt * D.speed * 0.8);
    for (const leaf of D.leaves) setLeaf(leaf, D.t);
    moved = true;
  }
  return moved;
}
export function setDoors(doors, t) { for (const D of doors) { const v = D.hold ?? t; D.t = D.target = v; for (const leaf of D.leaves) setLeaf(leaf, v); } }

// THE PARTS THAT GLIDE BY THEMSELVES (a piece's p.glide: the big scanner's ring along its rails). Call once a frame
// with the kit's clock (seconds; the same clock as the moving glows, materials.js U.time). Where each one stands is
// worked out from the clock alone, so nothing is kept from frame to frame: one whose room is not being drawn is left
// alone (and is in the right place again the frame its room comes back), and one resting at an end costs a
// comparison. Returns whether any moved.
const _gb = new THREE.Box3();
// how far out (0 at rest .. 1 fully out) a glide is at a time: out for `go` seconds, still for `rest`, back, still
export function glideAt(G, now) {
  const round = 2 * (G.go + G.rest), u = (((now / round + (G.start || 0)) % 1) + 1) % 1 * round;
  return u < G.go ? u / G.go : u < G.go + G.rest ? 1 : u < 2 * G.go + G.rest ? 1 - (u - G.go - G.rest) / G.go : 0;
}
// A glide the game runs only while it is in use (the big scanner, only with someone lying on its bed: the game's maker,
// 2026-11-16; src/people.js sets D.use): D.use null, parked at rest; { from, end }, gliding from rest at the clock's
// `from`, parked again once the clock reaches `end` (the end of a round, at rest); D.use left unset (the Kit Lab, a part
// alone on the stand), the clock's own, all the time.
export function updateGlides(built, now) {
  let moved = false;
  for (const D of built?.glides || []) {
    if (D.hold != null || (D.room && !D.room.group.visible)) continue;
    const use = D.use, G0 = D.glide0 || (D.glide0 = { ...D.glide, start: 0 });
    const t = use === undefined ? glideAt(D.glide, now) : !use || (use.end != null && now >= use.end) ? 0 : glideAt(G0, Math.max(0, now - use.from));
    if (t !== D.t) { D.t = D.target = t; for (const leaf of D.leaves) setLeaf(leaf, t); moved = true; }
    // its hoop of light, where switched on: where the hoop is now and which side its bright part is on (three small
    // vectors handed to its room's materials: materials.js U.hoop)
    if (D.lit) {
      const H = D.hoop, m = leafMatrix(H.leaf, D.t, _lm).premultiply(built.group.matrixWorld), a = (now / (H.every || 4) % 1) * Math.PI * 2;
      U.hoop.at.value.fromArray(H.at || [0, 0, 0]).applyMatrix4(m); U.hoop.axis.value.set(0, 0, 1).transformDirection(m);
      U.hoop.head.value.set(Math.cos(a), Math.sin(a), 0).transformDirection(m);
      U.hoop.light.value.fromArray(H.color || [1, 1, 1]).multiplyScalar(H.i ?? 0.3); U.hoop.size.value.set(H.r ?? 1, H.reach ?? 3);
    }
  }
  return moved;
}
// Switch a station's moving hoop of light on or off (a glide whose leaf carries one: piece.js leaf `hoop`): its room's
// own painted materials are told to take its light (materials.js hoopLit). Call it once, after buildRoom and before the
// first picture; the game and the Kit Lab switch it on at the high quality setting only. (A room built with materials
// shared by everything, a part alone in the lab, is left as it is.)
export function hoopLights(built, on = true, shared = null) {
  for (const D of built?.glides || []) {
    if (!D.hoop || !D.room || D.hold != null || D.room.mats === shared) continue;
    hoopLit(D.room.mats, on); D.lit = on;
    if (!on) U.hoop.light.value.set(0, 0, 0);
  }
}

// the box a room's pieces fill (their own parts and door leaves, as placed)
export function roomBounds(room) {
  const box = new THREE.Box3(), b = new THREE.Box3();
  for (const zd of zonesOf(room)) for (const pl of expand(zd.pieces || [])) {
    const def = PIECES[pl.piece], p = builtPiece(pl.piece, pl.variant), off = [...(pl.off || [0, 0, 0])];
    if (def.at === 'wall') off[2] += WALL_FACE;
    if (def.raise) off[1] += def.raise;
    placeMatrix({ ...pl, off }, _m, gridOf(zd, room));
    for (const part of p.parts) { part.geo.computeBoundingBox(); box.union(b.copy(part.geo.boundingBox).applyMatrix4(_m)); }
    for (const mv of p.movers) for (const part of mv.piece.parts) {
      part.geo.computeBoundingBox(); box.union(b.copy(part.geo.boundingBox).applyMatrix4(mv.base).applyMatrix4(_m));
      // (a part that glides by itself: and where it is when fully out)
      if (p.doors.find((d) => d.id === mv.door)?.glide) box.union(b.copy(part.geo.boundingBox).applyMatrix4(mv.base).translate(mv.slide).applyMatrix4(_m));
    }
  }
  return box;
}

// a room file, fetched (the game will load its rooms the same way)
export async function loadRoom(url) { const r = await fetch(url); if (!r.ok) throw new Error('kit: no room at ' + url); return r.json(); }
