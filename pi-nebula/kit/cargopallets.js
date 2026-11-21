// THE FORKLIFT'S OWN PALLETS IN CARGO (kit/places-plan.js CARGO has the game's maker's words and where they stand): the
// kit's own pallet piece (kit/store.js pallet: a low platform, its load on it), so a pallet he makes of his own one
// day takes the place of that piece and these with it. They are drawn apart from the room, as the room's still parts
// cannot move: each pallet a mesh of its own, the kit's piece as Cargo builds it, painted and lit with Cargo's own
// materials (its picture of itself for the shine). Its light is worked out as the kit lights what moves: its own
// corner darkening once, on itself, and the light Cargo's lamps throw on each vertex where it stands (kit/bake.js
// lightAt: no shadows), as much of it as the room's own pallets there take of the same (PALLET_LOOK). Worked out once
// for each place.
//   const P = makePallets({ zone, lights, sky })     zone: Cargo's (its group, its materials); lights: the room's
//   P.list        [{ i, load, mesh, place }]          (place: the place id it stands at, or null while carried)
//   P.at(i, id)   pallet i stood at a place (its light there)
//   P.move(i, x, y, z, h)   pallet i somewhere else (carried: its light kept)
//   P.blend(i, a, b, k)     its light `k` of the way from place a's to place b's (sliding into the rack: into the shade)
//   P.facts       { tris, draws, ms }; P.dispose()
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { builtPiece, compact } from './layout.js';
import { bake, lightAt } from './bake.js';
import { CARGO, STORE } from './places-plan.js';
import { PLACES, placeById } from './forkliftround.js';

// HOW MUCH OF THAT LIGHT, as the room's own pallets take (their saved light, with its shadows, against the same worked
// out with none, on the same vertices: under row 6's first shelf 0.28 and 0.30, out in the open 0.8;
// ~/pw/space-math/FORKLIFT_2.md; on row 6's first shelf, under the second, 0.13 to 0.46, most of them 0.24 to 0.26:
// "Round 3" there); its turn at a place: its skids north to south
export const PALLET_LOOK = { open: 0.8, underShelf: 0.29, firstShelf: 0.25, h: Math.PI / 2 };

const BASE = new Map();
// a load's geometry once: the kit's piece (Cargo's coarse one), its parts merged, its corner darkening on itself
function baseOf(load) {
  if (!BASE.has(load)) {
    const p = builtPiece('pallet', load, true), geos = p.parts.filter((x) => x.mat === 'solid').map((x) => x.geo.clone());
    const g = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
    bake([g], [g], [], { voxel: 0.03, reach: 0.25, strength: 0.6 });
    g.deleteAttribute('aBake'); g.computeBoundingBox(); g.computeBoundingSphere();
    // (in the smaller numbers the room's own are in, so it is drawn by the very same program: kit/layout.js)
    compact(g, 'normal', Int16Array, 32767); compact(g, 'color', Uint8Array, 255); compact(g, 'aRMW', Uint8Array, 255);
    BASE.set(load, g);
  }
  return BASE.get(load);
}

// (a load's piece made ahead, so making them all is spread over a few frames)
export function warmLoad(load) { baseOf(load); }

export function makePallets({ zone, lights = [], sky = null }) {
  const t0 = performance.now(), group = new THREE.Group(); group.name = 'cargo:pallets';
  const floor = STORE.floor, box = zone.box;
  const near = lights.filter((l) => l.at[0] > box.min.x - 8 && l.at[0] < box.max.x + 8 && l.at[2] > box.min.z - 8 && l.at[2] < box.max.z + 8 && l.at[1] > box.min.y - 1 && l.at[1] < box.max.y + 1);
  const skyI = sky ? sky.i ?? 1 : 0, skyC = [1, 0.98, 0.95];
  const lit = new Map(), _p = new THREE.Vector3(), _n = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion();
  // the light on each vertex of a load standing at a place (once a place, for each load)
  function lightFor(load, id) {
    const key = load + '@' + id; if (lit.has(key)) return lit.get(key);
    const g = baseOf(load), q = placeById(id), P = g.attributes.position, N = g.attributes.normal, out = new Float32Array(P.count * 3);
    _m.makeRotationY(PALLET_LOOK.h).setPosition(q.at[0], floor + q.y, q.at[1]); _q.setFromRotationMatrix(_m);
    const k = q.up ? PALLET_LOOK.firstShelf : q.shelf ? PALLET_LOOK.underShelf : PALLET_LOOK.open;
    for (let v = 0; v < P.count; v++) {
      _p.set(P.getX(v), P.getY(v), P.getZ(v)).applyMatrix4(_m); _n.set(N.getX(v), N.getY(v), N.getZ(v)).normalize().applyQuaternion(_q);
      const [r, gg, b] = lightAt(_p, near, _n), s = skyI * (0.55 + 0.45 * _n.y);
      out[v * 3] = (r + s * skyC[0]) * k; out[v * 3 + 1] = (gg + s * skyC[1]) * k; out[v * 3 + 2] = (b + s * skyC[2]) * k;
    }
    lit.set(key, out); return out;
  }
  const list = CARGO.pallets.map((d, i) => {
    const base = baseOf(d.load), g = new THREE.BufferGeometry();
    for (const [name, a] of Object.entries(base.attributes)) g.setAttribute(name, a);
    g.setIndex(base.index); g.boundingBox = base.boundingBox; g.boundingSphere = base.boundingSphere;
    const mesh = new THREE.Mesh(g, zone.mats ? zone.mats.solid : null); mesh.name = 'cargo:pallet:' + i;
    group.add(mesh);
    return { i, load: d.load, mesh, place: null, own: new THREE.BufferAttribute(new Float32Array(base.attributes.position.count * 3), 3) };
  });
  function at(i, id) {
    const P = list[i], q = placeById(id), g = P.mesh.geometry, L = lightFor(P.load, id);
    if (!g.attributes.aBake || g.attributes.aBake.array !== L) g.setAttribute('aBake', new THREE.BufferAttribute(L, 3));
    P.place = id; P.mesh.position.set(q.at[0], floor + q.y, q.at[1]); P.mesh.rotation.set(0, PALLET_LOOK.h, 0); P.mesh.updateMatrix();
  }
  function move(i, x, y, z, h) { const P = list[i]; P.place = null; P.mesh.position.set(x, y, z); P.mesh.rotation.set(0, h, 0); P.mesh.updateMatrix(); }
  function blend(i, a, b, k) {
    const P = list[i], A = lightFor(P.load, a), B = lightFor(P.load, b), o = P.own.array;
    for (let j = 0; j < o.length; j++) o[j] = A[j] + (B[j] - A[j]) * k;
    P.own.needsUpdate = true; if (P.mesh.geometry.attributes.aBake !== P.own) P.mesh.geometry.setAttribute('aBake', P.own);
  }
  CARGO.pallets.forEach((d, i) => at(i, PLACES.find((q) => q.id === d.at).id));
  const tris = list.reduce((n, P) => n + P.mesh.geometry.index.count / 3, 0);
  return { group, list, at, move, blend, facts: { tris, draws: list.length, ms: Math.round(performance.now() - t0), pallets: list.length },
    dispose() { group.removeFromParent(); for (const P of list) P.mesh.geometry.dispose(); } };
}
