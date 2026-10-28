// THE TOWN'S DECOR: models/town/decor.json, made in the Town Lab (labs/town/): what was changed from the town as shipped
// (models/town/layout.json and planting.json), kept apart from them, small and plain. The game only reads it:
//   { v: 1,
//     moved:    { <layout id>: { x, z, rot, y, size, level, preset, seed, player } }   a building, prop or town tree put
//                                                              somewhere else (any of the fields; the rest stay as shipped).
//                                                              preset, seed: a code-built building's design (a cabin's
//                                                              cabins.js preset); player: true marks the player's cabin
//     removed:  [<layout id>, ...]                              taken away
//     placed:   [{ type: 'prop' | 'model' | 'tree', kind, x, z, rot, size, y, preset, seed }]   put down (rot: degrees; size:
//                                                              a prop's or a tree's scale, a building's longest side in
//                                                              metres; preset, seed: as in moved)
//     roads:    [{ mat, w, pts }]                               stone roads painted after the shipped ones
//     planting: { strokes: [stroke], items: [item], removed: [id, ...], procedural }   brush strokes (flowers painted,
//                                                              fence runs and their style, gates, patches cleared) and placed
//                                                              plants, after the shipped ones (planting.js has their fields) }
//   `name` on anything is a note for whoever reads the file, and is skipped.
// With no decor (no file, or an empty one) the town is exactly as shipped.
//
//   applyDecor(layout, planting, decor) -> { layout, planting, merged }   the shipped data with the decor laid over it
//     (new objects: the shipped ones are left alone); merged: the ids of the placed props drawn together (drawDecor)
//   drawDecor({ items, parent, heightAt, THREE, makeProp }) -> [InstancedMesh]   the placed props, one instanced mesh a kind
//     and material, standing on the ground as the town's own props do (objects/village.js place); three and the props'
//     maker handed in, so this file needs neither (the node tests read it)

// props that stay one object each, with the town's own (lit at night, turning, walked on, or a loaded model)
const ALONE = new Set(['lamp', 'valehexGlobe', 'stateMap', 'obelisk', 'dock', 'farmWagon', 'freightWagon', 'coveredWagon', 'chuckWagon']);   // (the wagons: loaded models, filled in when they come)
const num = (v, d = 0) => (Number.isFinite(+v) ? +v : d);
// (a code-built building's design and the player's-cabin mark, from a moved or placed entry: only what is there and sound)
const design = (m) => ({ ...(typeof m.preset === 'string' && m.preset ? { preset: m.preset } : {}), ...(+m.seed > 0 ? { seed: Math.round(+m.seed) } : {}), ...(m.player === true ? { player: true } : {}) });

export function applyDecor(layout, planting, decor) {
  const merged = new Set();
  if (!decor || typeof decor !== 'object' || !layout) return { layout, planting, merged };
  const L = { ...layout, items: (layout.items || []).map((it) => ({ ...it })), roads: [...(layout.roads || [])] };
  const moved = decor.moved && typeof decor.moved === 'object' ? decor.moved : {}, gone = new Set(Array.isArray(decor.removed) ? decor.removed : []);
  L.items = L.items.filter((it) => !gone.has(it.id));
  for (const it of L.items) {
    const m = moved[it.id]; if (!m || typeof m !== 'object') continue;
    for (const k of ['x', 'z', 'rot', 'y', 'size']) if (k in m && Number.isFinite(+m[k])) it[k] = +m[k];
    if ('level' in m) { if (m.level === true) it.level = true; else delete it.level; }
    Object.assign(it, design(m));
  }
  (Array.isArray(decor.placed) ? decor.placed : []).forEach((p, i) => {
    if (!p || typeof p !== 'object' || !p.kind || !Number.isFinite(+p.x) || !Number.isFinite(+p.z)) return;
    const type = p.type || 'prop', id = 'decor' + (i + 1);
    const it = { id, type, kind: p.kind, x: +p.x, z: +p.z, rot: num(p.rot), ...(p.size != null ? { size: +p.size } : {}), ...(num(p.y) ? { y: +p.y } : {}), ...(p.level === true ? { level: true } : {}), ...design(p) };
    L.items.push(it);
    if (type === 'prop' && !ALONE.has(p.kind)) merged.add(id);
  });
  if (Array.isArray(decor.roads)) L.roads.push(...decor.roads);
  let P = planting;
  const D = decor.planting;
  if (planting && D && typeof D === 'object') {
    const out = new Set(Array.isArray(D.removed) ? D.removed : []);
    P = { ...planting, strokes: (planting.strokes || []).filter((s) => !out.has(s.id)), items: (planting.items || []).filter((s) => !out.has(s.id)) };
    if (Array.isArray(D.strokes)) P.strokes.push(...D.strokes);
    if (Array.isArray(D.items)) P.items.push(...D.items);
    if (typeof D.procedural === 'boolean') P.procedural = D.procedural;
  }
  return { layout: L, planting: P, merged };
}

export function drawDecor({ items, parent, heightAt, THREE, makeProp }) {
  const byKind = new Map(), out = [];
  for (const it of items) { if (!byKind.has(it.kind)) byKind.set(it.kind, []); byKind.get(it.kind).push(it); }
  const M = new THREE.Matrix4(), Q = new THREE.Quaternion(), P = new THREE.Vector3(), S = new THREE.Vector3(), Y = new THREE.Vector3(0, 1, 0);
  for (const [kind, list] of byKind) {
    let proto; try { proto = makeProp(kind); } catch (e) { console.warn('decor: no prop called', kind); continue; }
    proto.updateMatrixWorld(true);
    proto.traverse((m) => {
      if (!m.isMesh) return;
      const im = new THREE.InstancedMesh(m.geometry, m.material, list.length);
      list.forEach((it, i) => im.setMatrixAt(i, M.compose(P.set(it.x, heightAt(it.x, it.z) + (it.y || 0), it.z), Q.setFromAxisAngle(Y, (it.rot || 0) * Math.PI / 180), S.setScalar(it.size || 1)).multiply(m.matrixWorld)));
      im.instanceMatrix.needsUpdate = true; im.computeBoundingSphere();
      im.castShadow = m.castShadow; im.receiveShadow = m.receiveShadow; im.name = 'decor:' + m.name; im.userData.decor = kind;
      parent.add(im); out.push(im);
    });
  }
  return out;
}
