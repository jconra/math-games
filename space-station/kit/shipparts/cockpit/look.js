// THE COCKPIT'S LOOK: what the cockpit parts (kit/shipparts/cockpit/*) share.
//   SEAT_LOOK[look]   the seats' upholstery: 'tan' (his pictures: caramel leather all over, on a dark frame), 'grey'
//                     (the hauler picture's light grey), 'station' (the station's own dark cushions on off-white shells)
//                     { pad, seam, shell, arm, frame, strap }
//   LIT               dimmer glows for small lit buttons and lamps (the station's GLOW is for light strips: too bright
//                     for a grid of buttons)
//   MFD[face]         a screen face for a multi-function display: a crop of the station's screen sheet (kit/tex.js), so
//                     no new faces are drawn: 'scope' (the radar's rings), 'radar' (the whole radar), 'bars' (life support
//                     bars, the whole face), 'text' (the terminal's lines, the whole face), 'sum' (the math station's sum).
//                     { rect, aspect }
//   mfd(p, opts)      a screen in a dark bezel with a row of keys under it, centred on x = 0, y = 0, its back on z = 0,
//                     facing +z. opts: face ('scope'), w (the face's width, 0.22), gain (1.6), frame (false: true adds
//                     a chunky charcoal frame round it)
//   turn(yaw, tilt)   a rot [rx, ry, rz] (the kit's put() order) that leans a part's face back by `tilt` (it looks up
//                     as well as out) and then turns it by `yaw` about the up axis
//   CHAR, CHAR2       the cockpit consoles' charcoal body and top
//   LEAN, FLAT        bevel options for small parts: one rounded step and no extra rows of vertices (108 triangles a
//                     box); or square edges (12 a box: for what is small, dark or hidden)
import * as THREE from 'three';
import { SCREEN_RECT } from '../../tex.js';
import { bevelBox, put } from '../../geo.js';
import { placeInto } from '../place.js';

export const LEAN = { r: 0.004, seg: 1, cell: 9, loops: [] }, FLAT = { r: 0 };
// the cockpit's consoles: a near-black charcoal body and a darker top, so the screens are the brightest thing (his
// pictures); off-white ('white2') caps and trim keep them in the station's family
export const CHAR = { c: '#2e3135', r: 0.5, m: 0.3, w: 0.6 }, CHAR2 = { c: '#24272a', r: 0.55, m: 0.25, w: 0.5 };
const pad = (c, r = 0.8, w = 0.3) => ({ c, r, m: 0, w });
export const SEAT_LOOK = {
  tan: { pad: pad('#a8783e', 0.7), seam: pad('#8b5f30', 0.74), shell: pad('#7f5a2f', 0.62), arm: pad('#8b5f30', 0.74), frame: 'gun', strap: pad('#232529', 0.9) },
  grey: { pad: pad('#aeaaa0', 0.78), seam: pad('#8d897f', 0.8), shell: pad('#7f7b72', 0.66), arm: pad('#8d897f', 0.8), frame: 'gun', strap: pad('#232529', 0.9) },
  station: { pad: pad('#2d3036', 0.85), seam: pad('#24272c', 0.88), shell: 'white', arm: pad('#2d3036', 0.85), frame: 'black', strap: 'yellow' },
};
export const LIT = { blue: [0.25, 1.1, 3.4], amber: [3.4, 1.5, 0.12], green: [0.2, 2.8, 0.45], white: [2.2, 2.2, 2.3], red: [3.4, 0.18, 0.12], off: null };

// a crop of a screen-sheet face: fractions across it from its top left (the sheet's rects run bottom to top in v)
function crop(r, x0, y0, x1, y1) { const [u0, v0, u1, v1] = r, du = u1 - u0, dv = v1 - v0; return [u0 + du * x0, v1 - dv * y1, u0 + du * x1, v1 - dv * y0]; }
// (each face is 512 x 256 px on the sheet: aspect = the crop's width / height in pixels)
export const MFD = {
  scope: { rect: crop(SCREEN_RECT.radar, 0.27, 0.04, 0.73, 0.96), aspect: 1 },
  radar: { rect: SCREEN_RECT.radar, aspect: 2 },
  bars: { rect: SCREEN_RECT.status, aspect: 2 },
  text: { rect: SCREEN_RECT.terminal, aspect: 2 },
  sum: { rect: crop(SCREEN_RECT.math, 0.03, 0.27, 0.97, 0.99), aspect: 2.6 },
};

export function mfd(p, { face = 'scope', w = 0.22, gain = 1.6, frame = false } = {}) {
  const F = MFD[face] || MFD.scope, h = w / F.aspect, b = 0.012, z = frame ? 0.016 : 0, fr = 0.022;
  if (frame) p.slab('black', -w / 2 - b - fr, w / 2 + b + fr, -h / 2 - b - 0.022 - fr, h / 2 + b + fr, 0, z, { r: 0.006, seg: 1, cell: 9, loops: [] });
  p.slab(frame ? CHAR2 : 'black', -w / 2 - b, w / 2 + b, -h / 2 - b - 0.022, h / 2 + b, z, z + 0.02, FLAT);
  p.slab('dark', -w / 2 - 0.002, w / 2 + 0.002, -h / 2 - 0.002, h / 2 + 0.002, z + 0.02, z + 0.021, { r: 0 });
  p.screen(F.rect, w, h, [0, 0, z + 0.0215], null, gain);
  // the keys along the bottom of the bezel (one lit)
  const n = Math.max(3, Math.min(6, Math.round(w / 0.045)));
  for (let i = 0; i < n; i++) {
    const x = -w / 2 + w * (i + 0.5) / n;
    p.slab('grey', x - 0.011, x + 0.011, -h / 2 - b - 0.016, -h / 2 - b - 0.006, z + 0.02, z + 0.026, { r: 0 });
  }
  p.glowSlab(LIT.green, w / 2 - 0.004, w / 2 + 0.004, -h / 2 - b - 0.015, -h / 2 - b - 0.007, z + 0.02, z + 0.024);
}

const _qy = new THREE.Quaternion(), _qx = new THREE.Quaternion(), _e = new THREE.Euler(), X = new THREE.Vector3(1, 0, 0), Y = new THREE.Vector3(0, 1, 0);
export function turn(yaw = 0, tilt = 0) {
  _qy.setFromAxisAngle(Y, yaw); _qx.setFromAxisAngle(X, -tilt); _qy.multiply(_qx);
  _e.setFromQuaternion(_qy, 'XYZ'); return [_e.x, _e.y, _e.z];
}
// a straight bar of square section t (or [tx, ty]) from point a to point b (struts, braces, posts)
export function bar(p, surf, a, b, t = 0.02, opts = { r: 0 }) {
  const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), L = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), d.normalize()), e = new THREE.Euler().setFromQuaternion(q, 'XYZ');
  return p.box(surf, Array.isArray(t) ? [t[0], t[1], L] : [t, t, L], A.add(B).multiplyScalar(0.5).toArray(), [e.x, e.y, e.z], opts);
}
// a panel (or a stick) set onto a host part: placeInto, and a note in the host's `mounts` of which parts it added, where
// it went and which way its base faces ('z': a panel's back, 'y': a stick's foot), so the checks can test that it sits
// on its face (neither floating off it nor sunk into it)
export function mount(p, src, { at = [0, 0, 0], rot = [0, 0, 0], scale = 1 } = {}, name = '', base = 'z') {
  const from = p.parts.length; placeInto(p, src, { at, rot, scale });
  (p.mounts ||= []).push({ name, from, to: p.parts.length, at, rot, scale, src, base });
}
// a glowing box of a size at `at`, turned by rot (a lamp, a lit strip at an angle); colour: a GLOW name or [r, g, b]
export function glowBox(p, color, size, at, rot) { const g = bevelBox(size, [0, 0, 0], { r: 0 }); put(g, at, rot || [0, 0, 0]); return p.add('glow', g, color); }
// a point in a frame placed at `at`, turned by rot (the same order as turn() and put()): local [x, y, z] -> [x, y, z]
const _m = new THREE.Matrix4(), _v = new THREE.Vector3();
export function local(at, rot, x, y, z) {
  _m.makeRotationFromEuler(_e.set(rot[0], rot[1], rot[2], 'XYZ')).setPosition(at[0], at[1], at[2]);
  return _v.set(x, y, z).applyMatrix4(_m).toArray();
}
