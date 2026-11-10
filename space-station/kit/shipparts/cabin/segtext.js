// SEGMENT LETTERING: words and numbers made of thin bars, as a sixteen-segment display draws them, for the labels and
// readouts on a ship's fittings where the kit's print sheet has no room (kit/tex.js's decal and screen sheets are full):
// the med bay's pouch labels (AIRWAY, IV / FLUIDS ...), a bag's TRAUMA, a tank's O2, a monitor's 72 and 118/76. No
// texture: each bar is two triangles in whatever material the caller asks for (dark bars on a pale label as 'solid', a
// readout's lit numbers as 'glow'), so a label costs about 12 triangles a letter and no draw of its own.
//   segText(p, text, o)  draws `text` (capitals, digits, space, / - + . :) into piece p, on the z = 0 plane facing +z
//                        before it is placed:
//     o.h      a letter's height (0.04)        o.w  its width (0.62 of h)       o.t  a bar's thickness (0.14 of h)
//     o.gap    between letters (0.3 of h)      o.align 'center' (the default: o.at is the middle of the line), 'left'
//     o.at, o.rot  where the line goes and how it is turned (kit/geo.js put)
//     o.look   a surface for 'solid', a glow colour for 'glow'       o.mat 'solid' (the default) or 'glow'
//   textWidth(text, o)  how wide the line comes out
import * as THREE from 'three';
import { add } from '../../bevel.js';

// the bars in a letter's box (0..1 across, 0..1 up): halves of the top (a1 a2), middle (g1 g2) and bottom (d1 d2), the
// sides in halves (f e on the left, top first; b c on the right), the middle upright in halves (i l) and the four
// diagonals from the corners to the middle (h j k m)
const BAR = {
  a1: [0, 1, 0.5, 1], a2: [0.5, 1, 1, 1], b: [1, 1, 1, 0.5], c: [1, 0.5, 1, 0], d1: [0, 0, 0.5, 0], d2: [0.5, 0, 1, 0],
  e: [0, 0, 0, 0.5], f: [0, 0.5, 0, 1], g1: [0, 0.5, 0.5, 0.5], g2: [0.5, 0.5, 1, 0.5], h: [0, 1, 0.5, 0.5], i: [0.5, 1, 0.5, 0.5],
  j: [1, 1, 0.5, 0.5], k: [0, 0, 0.5, 0.5], l: [0.5, 0, 0.5, 0.5], m: [1, 0, 0.5, 0.5],
  // (halves drawn as one bar where both are lit: fewer triangles, cleaner joins)
  a: [0, 1, 1, 1], d: [0, 0, 1, 0], g: [0, 0.5, 1, 0.5], L: [0, 0, 0, 1], R: [1, 0, 1, 1], I: [0.5, 0, 0.5, 1],
  dot: [0.45, 0.02, 0.55, 0.02], c1: [0.5, 0.72, 0.5, 0.78], c2: [0.5, 0.22, 0.5, 0.28],
};
const CHARS = {
  A: 'a b c e f g', B: 'a b c d g2 i l', C: 'a d e f', D: 'a b c d i l', E: 'a d e f g1', F: 'a e f g1', G: 'a c d e f g2', H: 'b c e f g',
  I: 'a d i l', J: 'b c d e', K: 'e f g1 j m', L: 'd e f', M: 'b c e f h j', N: 'b c e f h m', O: 'a b c d e f', P: 'a b e f g',
  Q: 'a b c d e f m', R: 'a b e f g m', S: 'a c d f g', T: 'a i l', U: 'b c d e f', V: 'e f k j', W: 'b c e f k m', X: 'h j k m',
  Y: 'h j l', Z: 'a d j k',
  0: 'a b c d e f j k', 1: 'b c', 2: 'a b d e g', 3: 'a b c d g2', 4: 'b c f g', 5: 'a c d f g', 6: 'a c d e f g', 7: 'a b c',
  8: 'a b c d e f g', 9: 'a b c d f g', '/': 'j k', '-': 'g', '+': 'g i l', '.': 'dot', ':': 'c1 c2', ' ': '',
};
// a letter's bars, with whole sides and the whole middle upright drawn as one where both halves are lit
function barsOf(ch) {
  const s = new Set((CHARS[ch] ?? '').split(' ').filter(Boolean));
  for (const [x, y, z] of [['e', 'f', 'L'], ['b', 'c', 'R'], ['i', 'l', 'I']]) if (s.has(x) && s.has(y)) { s.delete(x); s.delete(y); s.add(z); }
  return [...s].map((k) => BAR[k]);
}
const dims = (o) => { const h = o.h ?? 0.04; return { h, w: o.w ?? h * 0.62, t: o.t ?? h * 0.14, gap: o.gap ?? h * 0.3 }; };
export function textWidth(text, o = {}) { const { w, gap } = dims(o); const n = [...text].length; return n ? n * w + (n - 1) * gap : 0; }

export function segText(p, text, o = {}) {
  const { h, w, t, gap } = dims(o), pos = [], idx = [], chars = [...String(text).toUpperCase()];
  const x0 = o.align === 'left' ? 0 : -textWidth(text, o) / 2;
  chars.forEach((ch, n) => {
    const cx = x0 + n * (w + gap);
    for (const [ax, ay, bx, by] of barsOf(ch)) {
      // (a bar: its ends carried on half a thickness, so bars that meet close their corner)
      const A = [cx + ax * w, -h / 2 + ay * h], B = [cx + bx * w, -h / 2 + by * h], L = Math.hypot(B[0] - A[0], B[1] - A[1]) || 1;
      const d = [(B[0] - A[0]) / L, (B[1] - A[1]) / L], nn = [-d[1] * t / 2, d[0] * t / 2], e = [d[0] * t / 2, d[1] * t / 2], base = pos.length / 3;
      for (const [px, py] of [[A[0] - e[0] - nn[0], A[1] - e[1] - nn[1]], [B[0] + e[0] - nn[0], B[1] + e[1] - nn[1]], [B[0] + e[0] + nn[0], B[1] + e[1] + nn[1]], [A[0] - e[0] + nn[0], A[1] - e[1] + nn[1]]]) pos.push(px, py, 0);
      idx.push(base, base + 1, base + 2, base, base + 2, base + 3);
    }
  });
  if (!idx.length) return p;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(pos.length).fill(0).map((_, i) => (i % 3 === 2 ? 1 : 0)), 3));
  g.setIndex(idx);
  add(p, o.look ?? (o.mat === 'glow' ? 'white' : 'black'), g, o.at || [0, 0, 0], o.rot || [0, 0, 0], o.mat || 'solid');
  return p;
}
