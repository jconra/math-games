// PUTTING ONE PIECE INTO ANOTHER (the ships): a ship is one piece made of parts (kit/shipparts/*: wings, engines,
// windows, seats, controls...). Each part is drawn once into a piece of its own, standing at its own origin, and copied
// into the ship's piece wherever it goes: its geometry, its lights, its door leaves and its doors.
//
//   part(build, opts) -> Piece    the part as build(piece, opts) draws it; kept per build and opts, so a part used ten
//                                 times is drawn once
//   placeInto(dst, src, { at, rot, scale, id })
//       at [x, y, z], rot [rx, ry, rz] (radians, as the kit's put()), scale a number or [x, y, z]. A negative x scale
//       mirrors it (a left wing from a right one): its faces are turned back the right way out. (A part with door leaves
//       isn't mirrored: its leaves would show inside out.)
//       id: a prefix for src's door ids, so two copies of one part keep their doors apart (needed when src has doors)
//   placeAll(dst, src, list)      placeInto for each { at, rot, scale, id } in list
import * as THREE from 'three';
import { Piece } from '../piece.js';
import { fixWinding } from '../geo.js';

const CACHE = new Map();
export function part(build, opts = {}) {
  let byOpts = CACHE.get(build); if (!byOpts) CACHE.set(build, (byOpts = new Map()));
  const key = JSON.stringify(opts);
  let p = byOpts.get(key);
  if (!p) { p = new Piece(); p.kind = (build.name || 'part') + key; build(p, opts); byOpts.set(key, p); }
  return p;
}

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _v = new THREE.Vector3(), _s = new THREE.Vector3(), _lin = new THREE.Matrix3();
export function placeInto(dst, src, { at = [0, 0, 0], rot = [0, 0, 0], scale = 1, id = '' } = {}) {
  const sc = Array.isArray(scale) ? scale : [scale, scale, scale];
  _m.compose(_v.set(...at), _q.setFromEuler(_e.set(rot[0], rot[1], rot[2])), _s.set(...sc));
  const mirror = _m.determinant() < 0, grow = Math.max(...sc.map(Math.abs));
  if (mirror && src.movers.length) throw new Error('kit: a part with door leaves can\'t be mirrored');
  for (const { mat, geo } of src.parts) {
    const g = geo.clone().applyMatrix4(_m);
    if (mirror) fixWinding(g);
    dst.parts.push({ mat, geo: g });
  }
  for (const L of src.lights) dst.lights.push({ ...L, at: new THREE.Vector3(...L.at).applyMatrix4(_m).toArray(), dir: L.dir ? new THREE.Vector3(...L.dir).transformDirection(_m).toArray() : null, reach: (L.reach ?? 7) * grow });
  // (a leaf moves as M * slide * base in the piece that holds it: placed by P, that is M * (R slide) * (P base))
  _lin.setFromMatrix4(_m);
  const kind = src.kind || 'part';
  for (const mv of src.movers) dst.movers.push({ key: kind + '|' + mv.key, piece: mv.piece, base: _m.clone().multiply(mv.base), slide: mv.slide.clone().applyMatrix3(_lin), door: id + mv.door });
  for (const d of src.doors) dst.doors.push({ ...d, id: id + d.id, sense: new THREE.Vector3(...d.sense).applyMatrix4(_m).toArray(), near: d.near * grow });
  return dst;
}
export function placeAll(dst, src, list) { for (const o of list) placeInto(dst, src, o); return dst; }
