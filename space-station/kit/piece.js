// THE PIECE CONTEXT: what a piece's build function draws into. A piece is drawn once in its own frame (facing +z,
// standing on y = 0) and kept; the layout then copies it into place. It records:
//   parts   geometry for each material, already carrying its surface (colour, roughness, metalness, wear) per vertex
//   lights  where its glowing strips light the room from (for the bake): position, strength, colour, facing
//   movers  door leaves: drawn in their own frame, with where they sit when shut and how far they slide to open
import * as THREE from 'three';
import { bevelBox, sweep, extrude, lathe, plane, put, cylinder, fixWinding } from './geo.js';
import { SURF, GLOW, kitTextures } from './materials.js';

const lin = (hex) => { const c = new THREE.Color(hex); return [c.r, c.g, c.b]; };
const SURF_LIN = {};
function surfOf(s) {
  if (typeof s === 'string') { if (!SURF_LIN[s]) { const [c, r, m, w] = SURF[s]; SURF_LIN[s] = { c: lin(c), r, m, w }; } return SURF_LIN[s]; }
  return { c: lin(s.c), r: s.r ?? 0.5, m: s.m ?? 0, w: s.w ?? 0.5 };
}
function fill(g, name, size, val) {
  const n = g.attributes.position.count, a = new Float32Array(n * size);
  for (let i = 0; i < n; i++) for (let k = 0; k < size; k++) a[i * size + k] = val[k];
  g.setAttribute(name, new THREE.BufferAttribute(a, size));
}

// (a COARSE piece is the same piece with bigger steps between the vertices on its big faces: big rooms use it to keep
// their triangles down; small parts keep their detail. Pieces made while Piece.coarse is set are coarse.)
const coarsen = (size, o) => (Math.max(...size) < 0.5 ? o : { ...o, cell: Math.max(o.cell ?? 0.4, 1.5), loops: o.loops ?? [] });
export class Piece {
  constructor() { this.parts = []; this.lights = []; this.movers = []; this.doors = []; this.coarse = Piece.coarse; }
  // any geometry, as a material: solid takes a surface name, glow a glow name, decal/screen a tint
  add(mat, g, look) {
    if (!g.index) throw new Error('kit: a piece part must be indexed');
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) fill(g, 'uv', 2, [0, 0]);
    if (mat === 'solid') { const s = surfOf(look); fill(g, 'color', 3, s.c); fill(g, 'aRMW', 3, [s.r, s.m, s.w]); }
    else if (mat === 'glow') fill(g, 'color', 3, Array.isArray(look) ? look : GLOW[look]);
    else if (mat === 'decal' || mat === 'screen') fill(g, 'color', 3, Array.isArray(look) ? look : lin(look || '#ffffff'));
    fixWinding(g); this.parts.push({ mat, geo: g });
    return g;
  }
  // a bevelled box from its two corners: x0..x1, y0..y1, z0..z1
  slab(surf, x0, x1, y0, y1, z0, z1, opts = {}) {
    const size = [x1 - x0, y1 - y0, z1 - z0];
    return this.add('solid', bevelBox(size, [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], this.coarse ? coarsen(size, opts) : opts), surf);
  }
  // a bevelled box of a size, centred at `at`, turned by rot [rx, ry, rz]
  box(surf, size, at, rot, opts = {}) {
    const g = bevelBox(size, [0, 0, 0], this.coarse ? coarsen(size, opts) : opts); put(g, at, rot || [0, 0, 0]); return this.add('solid', g, surf);
  }
  glowSlab(name, x0, x1, y0, y1, z0, z1, opts = {}) {
    return this.add('glow', bevelBox([x1 - x0, y1 - y0, z1 - z0], [(x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2], { r: 0.003, seg: 1, cell: 9, ...opts }), name);
  }
  sweep(surf, profile, path, opts = {}) { return this.add(opts.mat || 'solid', sweep(profile, path, opts), surf); }
  extrude(surf, outline, depth, r, opts = {}) { return this.add(opts.mat || 'solid', extrude(outline, depth, r, opts), surf); }
  lathe(surf, pts, seg, at = [0, 0, 0], rot) { const g = lathe(pts, seg); put(g, at, rot || [0, 0, 0]); return this.add('solid', g, surf); }
  cyl(surf, r, h, at, rot, seg = 16) { const g = cylinder(r, h, [0, 0, 0], seg); put(g, at, rot || [0, 0, 0]); return this.add('solid', g, surf); }
  // a decal from the label sheet: w x h, facing +z at `at` (turned by rot), tinted
  decal(rectName, w, h, at, rot, tint = '#d9d7cf') {
    const r = kitTextures().decal.rect[rectName]; if (!r) throw new Error('kit: no decal ' + rectName);
    const g = plane(w, h, { uv: r, cell: 9 }); put(g, at, rot || [0, 0, 0]); return this.add('decal', g, tint);
  }
  screen(rect, w, h, at, rot, gain = 1.7) {
    const g = plane(w, h, { uv: rect, cell: 9 }); put(g, at, rot || [0, 0, 0]); return this.add('screen', g, [gain, gain, gain]);
  }
  glass(w, h, at, rot) { const g = plane(w, h, { cell: 9 }); put(g, at, rot || [0, 0, 0]); return this.add('glass', g); }
  // a light for the bake: at [x, y, z], strength i (a three.js point light's intensity), colour [r, g, b] (linear,
  // about 1), facing dir (or null for all round), reach in metres
  light(at, i, color = [1, 1, 1], dir = null, reach = 7) { this.lights.push({ at, i, color, dir, reach }); }
  // a door leaf: `build(leafPiece)` draws it in its own frame; `at` and `rot` place it shut; `slide` is how far it
  // moves (in the piece's frame) when fully open. `door` groups the leaves that open together; `sense` is where
  // someone has to come near to open it, and how near.
  leaf(key, build, { at = [0, 0, 0], rot = [0, 0, 0], slide, door = 0 }) {
    let lp = this._leafCache?.get(key);
    if (!lp) { lp = new Piece(); build(lp); (this._leafCache ||= new Map()).set(key, lp); }
    const base = new THREE.Matrix4().compose(new THREE.Vector3(...at), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rot)), new THREE.Vector3(1, 1, 1));
    this.movers.push({ key, piece: lp, base, slide: new THREE.Vector3(...slide), door });
  }
  door(id, sense, near = 2.6, speed = 1.6) { this.doors.push({ id, sense, near, speed }); }
}
Piece.coarse = false;

